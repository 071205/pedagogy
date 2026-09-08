import {pathToFileURL} from 'node:url';
import path from 'node:path';
const {verifyIdToken}=await import(pathToFileURL(path.resolve('worker/auth.js')));
import assert from 'node:assert/strict';
const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk=await crypto.subtle.exportKey('jwk',keys.publicKey);jwk.kid='audit-local';
globalThis.fetch=async()=>new Response(JSON.stringify({keys:[jwk]}),{headers:{'cache-control':'max-age=60'}});
const b64=x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url');
const now=Math.floor(Date.now()/1000),base={aud:'audit',iss:'https://securetoken.google.com/audit',sub:'fixture',iat:now,auth_time:now,exp:now+1000};
async function token(claims){const body=b64({alg:'RS256',kid:'audit-local'})+'.'+b64(claims);const sig=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(body));return body+'.'+Buffer.from(sig).toString('base64url');}
const valid=await token(base);assert.equal((await verifyIdToken(valid,'audit')).uid,'fixture');
for(const claims of [{...base,aud:'other'},{...base,exp:now-1000},{...base,iat:now+1000},{...base,sub:''}])await assert.rejects(verifyIdToken(await token(claims),'audit'));
const parts=valid.split('.');parts[1]=b64({...base,sub:'other'});await assert.rejects(verifyIdToken(parts.join('.'),'audit'));
console.log('AUTH: locally signed valid token accepted; wrong project/expired/future/empty UID/tampered signature rejected');
