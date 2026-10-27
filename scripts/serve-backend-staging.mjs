import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, lstat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildBackendStaging, verifyBackendStaging, ROOT, OUTPUT } from './build-backend-staging.mjs';
import { ORIGIN } from './backend-staging-config.mjs';

export async function startBackendStaging({ root=ROOT, configuration }={}) {
  // Failed fresh build must never serve an older, possibly differently configured artifact.
  await buildBackendStaging(root, configuration);
  const verified=await verifyBackendStaging(root);
  const files=verified.files;
  const publicRoot=join(root,OUTPUT,'public');
  const server=createServer(async(req,res)=>{
    try {
      if(req.headers.host!=='localhost:8796') {res.writeHead(403);res.end();return;}
      if(!['GET','HEAD'].includes(req.method)) {res.writeHead(405);res.end();return;}
      const u=new URL(req.url,ORIGIN);
      const aliases={'/':'index.html','/index':'index.html','/document-editor':'document-editor.html','/mock-exam-editor':'mock-exam-editor.html','/legal':'legal.html'};
      const name=aliases[u.pathname]||u.pathname.slice(1);
      if(name==='_headers'||!Object.hasOwn(files,name)) {res.writeHead(404);res.end();return;}
      // The host keeps the startup manifest. Reject a changed file (including a
      // concurrent rebuild) rather than serving a mixture of configurations.
      let path=publicRoot;
      const parent=await lstat(path);if(!parent.isDirectory()||parent.isSymbolicLink())throw Error('Unsafe A0 public root');
      const parts=name.split('/');
      for(const [i,part]of parts.entries()){
        path=join(path,part);const info=await lstat(path);
        if(info.isSymbolicLink()||(i===parts.length-1?!info.isFile():!info.isDirectory()))throw Error('Unsafe A0 asset path');
      }
      const bytes=await readFile(path);
      if(bytes.length!==files[name].bytes||createHash('sha256').update(bytes).digest('hex')!==files[name].sha256)throw Error('A0 asset changed after verification');
      const mime=name.endsWith('.html')?'text/html; charset=utf-8':/\.(m?js)$/.test(name)?'application/javascript; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':name.endsWith('.json')?'application/json':name.endsWith('.woff2')?'font/woff2':'application/octet-stream';
      res.setHeader('Content-Type',mime);res.setHeader('Cache-Control','no-store');
      res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
      if(name.endsWith('.html')) {
        const csp=bytes.toString('utf8').match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([\s\S]*?)"/i)?.[1];
        if(!csp)throw Error('Missing verified CSP');
        res.setHeader('Content-Security-Policy',csp.replace(/\s+/g,' ')+'; frame-ancestors '+(name==='mock-exam-editor.html'?"'self'":"'none'"));
      }
      res.end(req.method==='HEAD'?undefined:bytes);
    }catch{if(!res.headersSent)res.writeHead(500);res.end();}
  });
  try {
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(8796,'127.0.0.1',resolve);});
  }catch(error){server.close();throw Error('A0 localhost:8796 unavailable; no alternate origin selected');}
  return {server,configuration:verified.configuration,files,
    close:()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();})};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  try {
    const at=process.argv.indexOf('--config');
    if(at<0||!process.argv[at+1])throw Error('Use --config with the private verified configuration');
    let config;
    try{config=JSON.parse(await readFile(process.argv[at+1],'utf8'));}catch{throw Error('Invalid A0 configuration JSON');}
    const host=await startBackendStaging({configuration:config});
    console.log('A0 local-only host: '+ORIGIN+'; use a NEW empty browser profile. No remote deployment.');
    const stop=async()=>{await host.close();process.exit(0);};
    process.once('SIGTERM',stop);process.once('SIGINT',stop);
  }catch(error){console.error(error.message);process.exitCode=1;}
}
