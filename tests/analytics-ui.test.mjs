import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {renderReport,chart,translator,mountAnalytics} from '../site/admin/analytics.mjs';
import {previewReport} from './analytics-fixture.mjs';
test('dashboard renders both languages, real inventory, photo rankings and expandable visit details',()=>{
  const report=previewReport();
  for(const language of ['es','en']){
    const {document}=parseHTML(renderReport(report,{language}));
    assert.equal(document.querySelectorAll('.analytics-kpi').length,8);assert.equal(document.querySelectorAll('svg[role=img]').length,2);
    assert.equal(document.querySelectorAll('.analytics-visit').length,25);assert.ok(document.querySelector('.analytics-photos img'));
    assert.ok(document.querySelector('.analytics-method').textContent.includes(language==='en'?'90 days':'90 días'));
  }
  assert.match(renderReport(report,{language:'en'}),/Real properties over time/);assert.match(renderReport(report),/Propiedades reales a lo largo del tiempo/);
});
test('catalog labels and referrers cannot inject markup into the private dashboard',()=>{
  const report=previewReport();report.properties[0].name='<img src=x onerror=alert(1)>';report.visits[0].referrer='<script>alert(1)</script>';report.photos[0].name='" onerror="alert(1)';
  const {document}=parseHTML(renderReport(report,{language:'en'}));assert.equal(document.querySelector('script'),null);assert.equal(document.querySelector('[onerror]'),null);assert.ok([...document.querySelectorAll('table')].some(table=>table.textContent.includes('<img src=x')));
});
test('inventory graph shows isolated measurements, including zero, without connecting missing days',()=>{
  const html=chart([{day:'2026-11-08',value:2},{day:'2026-11-10',value:0}],{label:'Inventory',t:translator('en'),formatDay:value=>value});
  const {document}=parseHTML(html);const path=document.querySelector('path').getAttribute('d');assert.equal(path.includes(' L'),false);assert.equal(document.querySelectorAll('circle').length,2);assert.match(document.querySelector('table').textContent,/2026-11-100/);
});
test('empty reports show no invented visit or property history',()=>{
  const report=previewReport();report.startedAt=null;report.inventory=[];report.photos=[];report.properties=[];report.visits=[];
  const {document}=parseHTML(renderReport(report,{language:'en'}));assert.equal(document.querySelectorAll('.analytics-chart').length,0);assert.match(document.body?.textContent||document.toString(),/measurement begins/);
});
test('clearing the admin session invalidates a pending analytics response and removes private content',async()=>{
  const {document,window}=parseHTML('<section id="analytics-panel"><p data-analytics-status></p><div data-analytics-report>Private report</div></section>');let resolve;
  const controller={expire(){}};const api={session:()=>({}),request:()=>new Promise(done=>{resolve=done;})};
  const mounted=mountAnalytics({document,window,controller,api});const pending=mounted.load();
  window.dispatchEvent(new window.CustomEvent('arenal-admin-clear'));resolve(previewReport());await pending;
  assert.equal(document.querySelector('#analytics-panel').textContent,'');assert.equal(document.querySelector('#analytics-panel').hidden,true);
});
test('admin controls load analytics, apply the property filter, switch language and paginate visits',async()=>{
  const {document,window}=parseHTML('<section id="analytics-panel" translate="no"></section>'),calls=[];
  window.ArenalI18n={language:'en'};
  const api={session:()=>({}),async request(action,body){calls.push({action,body:{...body}});return previewReport(body);}};
  mountAnalytics({document,window,controller:{expire(){}},api,now:()=>Date.parse('2026-11-10T20:00:00Z')});
  const settle=()=>new Promise(resolve=>setImmediate(resolve));
  window.dispatchEvent(new window.CustomEvent('arenal-admin-panel',{detail:'analytics'}));await settle();
  assert.equal(calls[0].action,'analytics');assert.equal(document.querySelectorAll('.analytics-kpi').length,8);
  const nativeSelects=()=>{for(const select of document.querySelectorAll('select'))Object.defineProperty(select,'value',{configurable:true,get(){return this.querySelector('option[selected]')?.getAttribute('value')||this.querySelector('option').getAttribute('value');},set(value){for(const option of this.querySelectorAll('option')){if(option.getAttribute('value')===value)option.setAttribute('selected','');else option.removeAttribute('selected');}}});};nativeSelects();
  let form=document.querySelector('form');form.requestSubmit=()=>form.onsubmit({preventDefault(){}});
  // linkedom models selected options rather than the native select value setter.
  form.querySelector('[name=kind]').value='real';
  form.querySelector('[name=kind]').onchange();await settle();assert.equal(calls.at(-1).body.kind,'real');
  assert.equal(document.querySelectorAll('.analytics-photos article').length,1);
  document.querySelector('[data-visit-page="1"]').onclick();await settle();assert.equal(calls.at(-1).body.page,1);
  window.ArenalI18n.language='es';window.dispatchEvent(new window.CustomEvent('arenal-language-change'));assert.match(document.querySelector('.analytics-heading').textContent,/actividad de Arenal/);
  nativeSelects();form=document.querySelector('form');form.querySelector('[name=start]').onchange();assert.equal(form.querySelector('[name=period]').value,'custom');
});
