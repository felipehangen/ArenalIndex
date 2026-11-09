import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
const matches=vm.runInNewContext('('+source.match(/function matches\(d,f\)\{[^\n]+/)[0]+')');
const window={};vm.runInNewContext(fs.readFileSync(new URL('../site/ui-format.js',import.meta.url),'utf8'),{window});
const filters={currency:'all',price:[0,200000],unit:[0,500],area:[0,10000],house:'any',zone:'all'};
const usd={price:185000,area:3200,currency:'USD'},crc={price:95000000,area:3200,currency:'CRC'};
test('mixed-currency browsing shows both currencies without comparing their numeric amounts',()=>{
 assert.equal(matches(usd,filters),true);assert.equal(matches(crc,filters),true);
 assert.equal(matches(crc,{...filters,currency:'USD'}),false);assert.equal(matches(usd,{...filters,currency:'USD'}),true);
 assert.equal(matches(crc,{...filters,currency:'CRC',price:[0,100000000],unit:[0,40000]}),true);
 assert.equal(matches(crc,{...filters,currency:'CRC',price:[0,90000000],unit:[0,40000]}),false);
});
test('prices and map labels retain the listed currency',()=>{
 assert.equal(window.ArenalFormat.money(95000000,'CRC'),'₡95,000,000');
 assert.equal(window.ArenalFormat.compactMoney(95000000,'CRC'),'₡95M');
 assert.equal(window.ArenalFormat.money(185000,'USD'),'$185,000');
});
