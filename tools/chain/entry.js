import {createUmi} from '@metaplex-foundation/umi-bundle-defaults';
import {mplCore, updateV1, updateCollectionV1} from '@metaplex-foundation/mpl-core';
import {base58} from '@metaplex-foundation/umi/serializers';
import {createNoopSigner, publicKey, generateSigner, signerIdentity, transactionBuilder, createGenericFile, lamports} from '@metaplex-foundation/umi';
import {walletAdapterIdentity} from '@metaplex-foundation/umi-signer-wallet-adapters';
import {irysUploader} from '@metaplex-foundation/umi-uploader-irys';
import {toWeb3JsTransaction} from '@metaplex-foundation/umi-web3js-adapters';
import {setComputeUnitPrice, transferSol, createAccountWithRent} from '@metaplex-foundation/mpl-toolbox';

function pickProvider(){
  var w=window;
  return (w.phantom&&w.phantom.solana&&w.phantom.solana.isPhantom&&w.phantom.solana)||(w.solflare&&w.solflare.isSolflare&&w.solflare)||(w.backpack&&w.backpack.solana)||(w.solana&&w.solana.isPhantom&&w.solana)||null;
}
var T={provider:null};
T.hasWallet=function(){return !!pickProvider()};
T.connect=async function(){
  var p=pickProvider();if(!p)throw new Error("No Solana wallet found in this browser (Phantom or Solflare).");
  var r=await p.connect();T.provider=p;
  return String(r&&r.publicKey?r.publicKey:p.publicKey);
};
/* Arweave storage is paid with a small amount of SOL held by a throw-away key that only exists in this tab.
   The wallet funds it once (one approval); the leftover is sent back at the end. No wallet pop-up per file. */
T.temp=null;
T.makeUploader=function(rpc){
  var umi=createUmi(rpc).use(irysUploader({address:"https://uploader.irys.xyz"}));
  var k=T.temp||(T.temp=generateSigner(umi));
  umi.use(signerIdentity(k));
  return umi;
};
T.tempAddress=function(rpc){T.makeUploader(rpc);return String(T.temp.publicKey)};
T.fundTemp=async function(rpc,lamportsAmount){
  var umi=createUmi(rpc).use(mplCore()).use(walletAdapterIdentity(T.provider));
  T.makeUploader(rpc);
  await transferSol(umi,{destination:T.temp.publicKey,amount:lamports(lamportsAmount)}).sendAndConfirm(umi,{confirm:{commitment:"confirmed"}});
};
T.tempBalance=async function(rpc){
  var umi=createUmi(rpc);T.makeUploader(rpc);
  var b=await umi.rpc.getBalance(T.temp.publicKey);return Number(b.basisPoints);
};
T.sweepTemp=async function(rpc,toAddress){
  if(!T.temp)return 0;
  var umi=createUmi(rpc);umi.use(signerIdentity(T.temp));
  var bal=Number((await umi.rpc.getBalance(T.temp.publicKey)).basisPoints);
  var send=bal-5000;if(send<=0)return 0;
  await transferSol(umi,{source:T.temp,destination:publicKey(toAddress),amount:lamports(send)}).sendAndConfirm(umi,{confirm:{commitment:"confirmed"}});
  return send;
};
T.uploadMany=async function(umi,objs){
  var files=objs.map(function(o,i){return createGenericFile(new TextEncoder().encode(JSON.stringify(o)),"metadata"+i+".json",{contentType:"application/json"})});
  var uris=await umi.uploader.upload(files);
  return uris.map(function(u){return "https://gateway.irys.xyz/"+String(u).split("/").pop()});
};
/* Sends Core "update uri" instructions: 6 per transaction, one wallet approval per batch of transactions. */
T.sendUpdates=async function(rpc,collection,updates,opt){
  opt=opt||{};var per=opt.perTx||6,batch=opt.txPerApproval||20,prio=opt.priority||1000,log=opt.onProgress||function(){};
  var umi=createUmi(rpc).use(mplCore()).use(walletAdapterIdentity(T.provider));
  var groups=[];for(var i=0;i<updates.length;i+=per)groups.push(updates.slice(i,i+per));
  var res={ok:[],fail:[]};
  for(var s=0;s<groups.length;s+=batch){
    var part=groups.slice(s,s+batch);
    var bh=await umi.rpc.getLatestBlockhash({commitment:"confirmed"});
    var txs=part.map(function(g){
      var b=transactionBuilder().add(setComputeUnitPrice(umi,{microLamports:prio}));
      g.forEach(function(u){b=b.add(updateV1(umi,{asset:publicKey(u.asset),collection:publicKey(collection),newUri:u.uri}))});
      return b.setBlockhash(bh).build(umi);
    });
    var signed;
    try{signed=await umi.identity.signAllTransactions(txs)}catch(e){part.forEach(function(g){g.forEach(function(u){res.fail.push({asset:u.asset,error:"not approved in wallet"})})});log(res);return res}
    await Promise.all(signed.map(async function(tx,k){
      var g=part[k];
      try{
        var sig=await umi.rpc.sendTransaction(tx,{commitment:"confirmed",maxRetries:5});
        var c=await umi.rpc.confirmTransaction(sig,{strategy:{type:"blockhash",...bh},commitment:"confirmed"});
        if(c.value&&c.value.err)throw new Error(JSON.stringify(c.value.err));
        g.forEach(function(u){res.ok.push(u.asset)});
      }catch(e){g.forEach(function(u){res.fail.push({asset:u.asset,error:String(e.message||e)})})}
      log(res);
    }));
  }
  return res;
};

/* ---- move the collection's update authority (new wallet pays the fee, old wallet only co-signs) ---- */
T.activeAddress=function(){return T.provider&&T.provider.publicKey?String(T.provider.publicKey):""};
/* A durable nonce makes the transaction valid until it is used, so signing with two accounts can take as long as needed. */
var SYSTEM="11111111111111111111111111111111",SYS_BH="SysvarRecentB1ockHashes11111111111111111111",SYS_RENT="SysvarRent111111111111111111111111111111111";
function u32(n){var b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,n,true);return b}
T.nonce=null;
T.createNonce=async function(rpc){
  var umi=createUmi(rpc).use(mplCore()).use(walletAdapterIdentity(T.provider));
  var nk=generateSigner(umi),auth=umi.identity.publicKey;
  var init={programId:publicKey(SYSTEM),keys:[{pubkey:nk.publicKey,isSigner:false,isWritable:true},{pubkey:publicKey(SYS_BH),isSigner:false,isWritable:false},{pubkey:publicKey(SYS_RENT),isSigner:false,isWritable:false}],data:(function(){var d=new Uint8Array(36);d.set(u32(6),0);d.set(base58.serialize(String(auth)),4);return d})()};
  var b=createAccountWithRent(umi,{newAccount:nk,payer:umi.identity,space:80,programId:publicKey(SYSTEM)}).add({instruction:init,signers:[],bytesCreatedOnChain:0});
  await b.sendAndConfirm(umi,{confirm:{commitment:"confirmed"}});
  T.nonce=String(nk.publicKey);return T.nonce;
};
async function readNonce(rpc,addr){
  for(var i=0;i<10;i++){
    var r=await rawRpc(rpc,"getAccountInfo",[addr,{encoding:"base64",commitment:"confirmed"}]);
    var v=r.result&&r.result.value;
    if(v){var bin=atob(v.data[0]),bytes=new Uint8Array(bin.length);for(var k=0;k<bin.length;k++)bytes[k]=bin.charCodeAt(k);if(bytes.length>=72&&bytes[4]===1)return base58.deserialize(bytes.slice(40,72))[0]}
    await new Promise(function(x){setTimeout(x,1500)});
  }
  throw new Error("Could not read the nonce account yet. Try again in a moment.");
}
T.buildAuthorityTx=async function(rpc,collection,oldAddr,newAddr){
  if(!T.nonce)throw new Error("Create the nonce account first");
  var umi=createUmi(rpc).use(mplCore());
  var nw=createNoopSigner(publicKey(newAddr)),od=createNoopSigner(publicKey(oldAddr));
  umi.use(signerIdentity(nw));
  var nonceVal=await readNonce(rpc,T.nonce);
  var adv={programId:publicKey(SYSTEM),keys:[{pubkey:publicKey(T.nonce),isSigner:false,isWritable:true},{pubkey:publicKey(SYS_BH),isSigner:false,isWritable:false},{pubkey:publicKey(newAddr),isSigner:true,isWritable:false}],data:u32(4)};
  var b=transactionBuilder().add({instruction:adv,signers:[nw],bytesCreatedOnChain:0})
    .add(updateCollectionV1(umi,{collection:publicKey(collection),payer:nw,authority:od,newUpdateAuthority:publicKey(newAddr)}))
    .setFeePayer(nw).setBlockhash({blockhash:nonceVal,lastValidBlockHeight:BigInt(Number.MAX_SAFE_INTEGER)});
  var tx=await b.build(umi);
  T.authTx=toWeb3JsTransaction(tx);
  return true;
};
T.signAuthTx=async function(){
  if(!T.authTx)throw new Error("Build the transaction first");
  T.authTx=await T.provider.signTransaction(T.authTx);
  return T.authTx.signatures.filter(function(s){return s.some(function(b){return b!==0})}).length;
};
async function rawRpc(rpc,method,params){var r=await fetch(rpc,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:method,params:params})});return r.json()}
T.simulateAuthTx=async function(rpc){
  var b64=btoa(String.fromCharCode.apply(null,T.authTx.serialize()));
  var r=await rawRpc(rpc,"simulateTransaction",[b64,{encoding:"base64",sigVerify:true,commitment:"confirmed"}]);
  if(r.error)throw new Error(r.error.message);
  return r.result.value;
};
T.sendAuthTx=async function(rpc){
  var b64=btoa(String.fromCharCode.apply(null,T.authTx.serialize()));
  var r=await rawRpc(rpc,"sendTransaction",[b64,{encoding:"base64",preflightCommitment:"confirmed",maxRetries:5}]);
  if(r.error)throw new Error(r.error.message);
  var sig=r.result;
  for(var i=0;i<30;i++){
    await new Promise(function(x){setTimeout(x,2000)});
    var st=await rawRpc(rpc,"getSignatureStatuses",[[sig],{searchTransactionHistory:true}]);
    var v=st.result&&st.result.value&&st.result.value[0];
    if(v){if(v.err)throw new Error("Transaction failed: "+JSON.stringify(v.err));if(v.confirmationStatus==="confirmed"||v.confirmationStatus==="finalized")return sig}
  }
  throw new Error("Not confirmed yet. Signature: "+sig);
};
window.TenseiChain=T;
