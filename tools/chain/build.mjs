import {build} from 'esbuild';
import {polyfillNode} from 'esbuild-plugin-polyfill-node';
await build({entryPoints:['entry.js'],bundle:true,minify:true,format:'iife',platform:'browser',outfile:'admin-chain.js',define:{global:'window','process.env.NODE_ENV':'"production"'},plugins:[polyfillNode({polyfills:{crypto:true,stream:true,buffer:true,process:true,fs:'empty',os:'empty',path:true,util:true,events:true,http:'empty',https:'empty',zlib:'empty',url:true}})],logLevel:'error',logLimit:0});
