import {createUmi} from '@metaplex-foundation/umi-bundle-defaults';
import {mplCore, updateV1} from '@metaplex-foundation/mpl-core';
import {publicKey, generateSigner, signerIdentity, transactionBuilder, createGenericFile, lamports} from '@metaplex-foundation/umi';
import {walletAdapterIdentity} from '@metaplex-foundation/umi-signer-wallet-adapters';
import {irysUploader} from '@metaplex-foundation/umi-uploader-irys';
import {setComputeUnitPrice, transferSol} from '@metaplex-foundation/mpl-toolbox';

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
window.TenseiChain=T;
