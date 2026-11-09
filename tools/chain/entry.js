import {createUmi} from '@metaplex-foundation/umi-bundle-defaults';
import {mplCore, updateV1, updateCollectionV1} from '@metaplex-foundation/mpl-core';
import {base58} from '@metaplex-foundation/umi/serializers';
import {createNoopSigner, publicKey, generateSigner, signerIdentity, transactionBuilder, createGenericFile, lamports} from '@metaplex-foundation/umi';
import {walletAdapterIdentity} from '@metaplex-foundation/umi-signer-wallet-adapters';
import {irysUploader} from '@metaplex-foundation/umi-uploader-irys';
import {toWeb3JsTransaction} from '@metaplex-foundation/umi-web3js-adapters';
import {setComputeUnitPrice, setComputeUnitLimit, transferSol, createAccountWithRent} from '@metaplex-foundation/mpl-toolbox';

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
  /* one file per upload call: a multi-file upload can return the links in a different order than the files */
  /* at most 3 at a time, waiting and retrying when the storage service says "Too Many Requests" */
  var uris=new Array(files.length),next=0;
  async function one(f){for(var i=0;;i++){try{return (await umi.uploader.upload([f]))[0]}catch(e){if(i>=8||!/429|too many|rate|timeout|network|fetch/i.test(String(e.message||e)))throw e;await new Promise(function(x){setTimeout(x,1500*Math.pow(1.7,i)+Math.random()*500)})}}}
  async function worker(){while(next<files.length){var k=next++;uris[k]=await one(files[k])}}
  await Promise.all([worker(),worker(),worker()]);
  return uris.map(function(u){return "https://gateway.irys.xyz/"+String(u).split("/").pop()});
};
/* Sends Core "update uri" instructions: 6 per transaction, one wallet approval per batch of transactions. */
var PUBLIC_RPC="https://api.mainnet-beta.solana.com";
function broadcast(raw){return fetch(PUBLIC_RPC,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"sendTransaction",params:[raw,{encoding:"base64",skipPreflight:true,maxRetries:0}]})}).catch(function(){})}
T.sendUpdates=async function(rpc,collection,updates,opt){
  opt=opt||{};var per=opt.perTx||6,batch=opt.txPerApproval||20,prio=opt.priority||300000,log=opt.onProgress||function(){};
  var umi=createUmi(rpc).use(mplCore()).use(walletAdapterIdentity(T.provider));
  var groups=[];for(var i=0;i<updates.length;i+=per)groups.push(updates.slice(i,i+per));
  var res={ok:[],fail:[]};
  for(var s=0;s<groups.length;s+=batch){
    var part=groups.slice(s,s+batch);
    var lb=await rawRpc(rpc,"getLatestBlockhash",[{commitment:"confirmed"}]);
    if(!lb.result)throw new Error("Could not get a recent blockhash");
    var bh={blockhash:lb.result.value.blockhash,lastValidBlockHeight:lb.result.value.lastValidBlockHeight};
    var txs=part.map(function(g){
      var b=transactionBuilder().add(setComputeUnitLimit(umi,{units:120000})).add(setComputeUnitPrice(umi,{microLamports:prio}));
      g.forEach(function(u){b=b.add(updateV1(umi,{asset:publicKey(u.asset),collection:publicKey(collection),newUri:u.uri}))});
      return b.setBlockhash(bh).build(umi);
    });
    var signed;
    try{signed=await umi.identity.signAllTransactions(txs)}catch(e){part.forEach(function(g){g.forEach(function(u){res.fail.push({asset:u.asset,error:"not approved in wallet"})})});log(res);return res}
    /* send every transaction once (spaced out for the free RPC plan), then check all of them with one status call per round */
    var items=signed.map(function(tx,k){return {g:part[k],raw:btoa(String.fromCharCode.apply(null,umi.transactions.serialize(tx))),sig:base58.deserialize(tx.signatures[0])[0],state:"sent",err:""}});
    for(var k=0;k<items.length;k++){
      var it=items[k];
      try{var sr=await rawRpc(rpc,"sendTransaction",[it.raw,{encoding:"base64",preflightCommitment:"confirmed",maxRetries:5}]);
        if(sr.error&&!/already been processed/i.test(sr.error.message||"")){it.state="fail";it.err=sr.error.message||JSON.stringify(sr.error)}
        else broadcast(it.raw)}
      catch(e){it.err=String(e.message||e)}
      await new Promise(function(x){setTimeout(x,150)});
    }
    for(var round=0;round<60;round++){
      var open=items.filter(function(it){return it.state==="sent"});if(!open.length)break;
      await new Promise(function(x){setTimeout(x,2500)});
      try{
        var st=await rawRpc(rpc,"getSignatureStatuses",[open.map(function(it){return it.sig}),{searchTransactionHistory:round>20}]);
        var vals=(st.result&&st.result.value)||[];
        open.forEach(function(it,j){var v=vals[j];if(!v)return;
          if(v.err){it.state="fail";it.err=JSON.stringify(v.err)}
          else if(v.confirmationStatus==="confirmed"||v.confirmationStatus==="finalized")it.state="ok"});
        var still=items.filter(function(it){return it.state==="sent"});
        if(still.length){
          var h=await rawRpc(rpc,"getBlockHeight",[{commitment:"confirmed"}]);
          if((h.result||0)>Number(bh.lastValidBlockHeight)+10){still.forEach(function(it){it.state="fail";it.err=(it.err?it.err+"; then ":"")+"expired before landing (nothing changed), sig "+it.sig});}
          else{for(var q=0;q<still.length;q++){broadcast(still[q].raw);if(round%2===1)await rawRpc(rpc,"sendTransaction",[still[q].raw,{encoding:"base64",skipPreflight:true,maxRetries:0}]).catch(function(){});await new Promise(function(x){setTimeout(x,150)})}}
        }
      }catch(e){}
      log({ok:res.ok.concat([].concat.apply([],items.filter(function(it){return it.state==="ok"}).map(function(it){return it.g.map(function(u){return u.asset})}))),fail:res.fail});
    }
    /* for anything that did not land, ask the chain why (size, programs, simulation result) */
    for(var d=0;d<items.length;d++){var it2=items[d];if(it2.state==="ok")continue;
      try{var bytes=Uint8Array.from(atob(it2.raw),function(ch){return ch.charCodeAt(0)});
        var msg=signed[d].message,progs=msg.instructions.map(function(ix){return String(msg.accounts[ix.programIndex]).slice(0,6)}).join(",");
        var sim=await rawRpc(rpc,"simulateTransaction",[it2.raw,{encoding:"base64",sigVerify:true,replaceRecentBlockhash:false}]);
        var sv=sim.result&&sim.result.value,last=sv&&sv.logs&&sv.logs.length?sv.logs[sv.logs.length-1]:"";
        it2.err+=" [diag size "+bytes.length+" ix "+progs+" sim "+(sim.error?sim.error.message:JSON.stringify(sv&&sv.err))+" "+String(last).slice(0,120)+"]";
      }catch(e){it2.err+=" [diag failed "+String(e.message||e).slice(0,80)+"]"}
    }
    items.forEach(function(it){
      if(it.state==="ok")it.g.forEach(function(u){res.ok.push(u.asset)});
      else it.g.forEach(function(u){res.fail.push({asset:u.asset,error:it.err||("not confirmed yet, sig "+it.sig)})});
    });
    log(res);
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
async function rawRpc(rpc,method,params){
  /* the free Helius plan limits requests per second: wait and retry instead of failing */
  for(var i=0;;i++){
    var r=null;try{r=await fetch(rpc,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:method,params:params})})}catch(e){if(i>=8)throw e}
    if(r&&r.ok){try{return await r.json()}catch(e){if(i>=8)throw e}}
    else if(r&&r.status!==429&&r.status<500||i>=8)throw new Error("RPC "+(r?r.status:"network")+" on "+method);
    await new Promise(function(x){setTimeout(x,800*Math.pow(1.6,i)+Math.random()*400)});
  }
}
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
