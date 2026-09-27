import test from 'node:test';
import assert from 'node:assert/strict';
import {translateText, translateTree} from './src/i18n.ts';
test('Arabic interface labels use readable Arabic text',()=>{
 assert.equal(translateText('Dashboard'),'\u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u062d\u0643\u0645');
 assert.equal(translateText('Task documents'),'\u0645\u0633\u062a\u0646\u062f\u0627\u062a \u0627\u0644\u0645\u0647\u0645\u0629');
 assert.equal(translateText('3 results'),'3 \u0646\u062a\u064a\u062c\u0629');
});
test('translation preserves live percentages and attributes instead of restoring stale values',()=>{
 const text={nodeValue:'0%',parentElement:{tagName:'B'}};
 const attrs=new Map([['aria-label','0% completed']]);
 const element={getAttribute:name=>attrs.get(name)??null,setAttribute:(name,value)=>attrs.set(name,value)};
 globalThis.NodeFilter={SHOW_TEXT:4};
 globalThis.document={body:{},createTreeWalker:()=>{let used=false;return {nextNode:()=>{if(used)return null;used=true;return text;}};},querySelectorAll:()=>[element]};
 translateTree('en');
 text.nodeValue='50%';attrs.set('aria-label','50% completed');
 translateTree('en');assert.equal(text.nodeValue,'50%');assert.equal(attrs.get('aria-label'),'50% completed');
 translateTree('ar');translateTree('en');assert.equal(text.nodeValue,'50%');
 text.nodeValue='100%';translateTree('en');assert.equal(text.nodeValue,'100%');
});
