import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const mock=read('mock-exam-editor.html'), index=read('index.html');
const splitSource=mock.match(/function splitConditionLines\(text\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(splitSource);
const split=vm.runInNewContext(`(${splitSource})`);
for(const input of ['', 'abc', ' (단,x)', 'a\n\t(단,x)  (단,y)', '(단,(단,', '끝   ']){
  assert.equal(split(input), input.replace(/\s*(\(단,)/g,'\n$1'));
}
const large=' '.repeat(200_000)+'x';
assert.equal(vm.runInNewContext(`${splitSource}; splitConditionLines(input)`,{input:large},{timeout:1000}),large);
// Removing whitespace trimming must break the formatting contract. Timing of
// the old regex is engine-dependent, so do not use it as a flaky red oracle.
const broken=vm.runInNewContext(`(${splitSource.replace('part.trimEnd()', 'part')})`);
assert.throws(()=>assert.equal(broken('a  (단,x)'), 'a\n(단,x)'));
const blobSource=index.match(/function dataUrlToBlob\(dataUrl\)\{[\s\S]*?\n\}/)?.[0];
const toBlob=vm.runInNewContext(`(${blobSource})`,{Blob,atob,Uint8Array});
const blob=toBlob('data:image/png;base64,SGk=');
assert.equal(blob.type,'image/png'); assert.equal(await blob.text(),'Hi');
assert.throws(()=>toBlob('x:'.repeat(10000)+';base64,SGk='));
for(const [file,ids] of [['index.html',['loadInput','importAllInput','importMockInput','qAnswerImg','aiImgInput']],['mock-exam-editor.html',['round','elective']],['document-editor.html',['request']]]){
  const html=read(file);
  for(const id of ids){
    const tag=html.match(new RegExp(`<[^>]+id="${id}"[^>]*>`))?.[0];
    assert.match(tag,/aria-label="[^"]+"/);
    assert.throws(()=>assert.match(tag.replace(/aria-label="[^"]+"/,''),/aria-label="[^"]+"/));
  }
}
assert.match(read('legal.html'),/<nav aria-label="[^"]+">/);
assert.match(index,/<title>[^<]+<\/title>/);
const rgb=[0x17,0x5c,0xd3].map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
assert.ok(1.05/(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722+.05)>=4.5);
assert.match(index,/#mockModeBtn\.on\{background:#175CD3;/);
const workflow=read('.github/workflows/verify.yml');
assert.equal((workflow.match(/npm ci --ignore-scripts/g)||[]).length,3);
assert.equal((workflow.match(/\.\/node_modules\/\.bin\/playwright install/g)||[]).length,3);
console.log('Sonar targeted fixes: regex equivalence + trim red, bounded large input, data URL, labels red, contrast, CI policy PASS');
