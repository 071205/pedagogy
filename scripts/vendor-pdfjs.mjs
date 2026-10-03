/* Reproducible exact runtime vendoring from package-lock's pinned PDF.js package.
   No maps, viewer UI or QuickJS scripting engine are published. */
import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import path from 'node:path';
const root='node_modules/pdfjs-dist',dest='vendor/pdfjs';
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
if(pkg.version!=='6.3.289')throw Error('Review the pinned PDF.js version before vendoring');
await mkdir(dest,{recursive:true});
for(const file of ['pdf.mjs','pdf.worker.mjs']){
  const src=await readFile(path.join(root,'legacy/build',file),'utf8');
  await writeFile(path.join(dest,file),src.replace(/^\/\/# sourceMappingURL=.*\n?/gm,'').replace(/^(\/\*+\/) +$/gm,'$1').trimEnd()+'\n');
}
await copyFile(path.join(root,'LICENSE'),path.join(dest,'LICENSE'));
const assets=[];
for(const directory of ['cmaps','standard_fonts','wasm','iccs']){
  await mkdir(path.join(dest,directory),{recursive:true});
  for(const item of (await readdir(path.join(root,directory),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
    if(!item.isFile()||item.name.startsWith('quickjs'))continue;
    const output=path.posix.join(dest,directory,item.name);
    await copyFile(path.join(root,directory,item.name),output);
    if(item.name.startsWith('LICENSE')){
      const license=await readFile(output,'utf8');
      await writeFile(output,license.split(/\r?\n/).map(line=>line.trimEnd()).join('\n').trimEnd()+'\n');
    }
    assets.push(output);
  }
}
await writeFile(path.join(dest,'assets.json'),JSON.stringify(assets,null,2)+'\n');
console.log('Vendored PDF.js 6.3.289 and exact font/CMap/codec inventory');
