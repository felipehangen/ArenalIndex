import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const window={};
for(const file of ['catalog.js','property-content.js'])vm.runInNewContext(read('site/'+file),{window});
const rows=JSON.parse(read('supabase/demo-properties-v2.json'));
const item=index=>window.ArenalData.normalize(rows[index]);

test('card highlights come from facts and stay capped at three without advertising unknown services',()=>{
 for(let i=0;i<rows.length;i++)assert.ok(window.ArenalListing.highlights(item(i)).length<=3);
 const labels=i=>Array.from(window.ArenalListing.highlights(item(i)),f=>f.label);
 assert.deepEqual(labels(0),['2 constr.','Vista al volcán','Agua activa']);
 assert.deepEqual(labels(1),['Condominio','Carta de agua']);
 assert.deepEqual(labels(2),['Vista al volcán']); // Nearby utility lines are not active services.
 assert.deepEqual(labels(5),['Agua activa','Luz activa']);
 assert.deepEqual(labels(6),['Agua natural']); // No claim of a lake or a river specifically.
 assert.ok(!labels(9).includes('Luz activa')); // Inactive meter.
 const unknown=window.ArenalData.normalize({...rows[0],details:null});
 assert.ok(!window.ArenalListing.highlights(unknown).some(f=>/Agua|Luz/.test(f.label)));
});

test('only explicitly public contacts are normalized; invalid targets and private seller fields stay out',()=>{
 const normalize=contact=>window.ArenalData.normalize({...rows[0],email:'private@example.com',phone:'50611111111',details:{...rows[0].details,contact}}).details.contact;
 assert.equal(normalize(null),null);
 assert.equal(normalize({email:'a@example.com\r\nBcc: other@example.com',phone:'javascript:alert(1)',whatsapp:'../bad'}),null);
 assert.equal(normalize({email:'felipehangen@gmail.com'}).email,'felipehangen@gmail.com');
 assert.equal(normalize({phone:'+50688542664'}).phone,'50688542664');
 assert.equal(normalize({whatsapp:'14155552671'}).whatsapp,'14155552671');
});

test('contact actions preserve international numbers and original asking prices without preview credentials',()=>{
 const d=window.ArenalData.normalize({...rows[0],details:{...rows[0].details,contact:{name:'Felipe',whatsapp:'50688542664',phone:'50688542664',email:'felipehangen@gmail.com'}}});
 const links=window.ArenalListing.contactLinks(d),whatsapp=new URL(links.whatsapp);
 assert.equal(whatsapp.origin,'https://wa.me');assert.equal(whatsapp.pathname,'/50688542664');
 assert.match(whatsapp.searchParams.get('text'),/demostración/);
 assert.match(whatsapp.searchParams.get('text'),/₡97,000,000 CRC/);
 assert.ok(whatsapp.searchParams.get('text').endsWith('https://arenalindex.com/#propiedad/lot-1'));
 assert.equal(links.phone,'tel:+50688542664');assert.equal(links.phoneLabel,'+506 8854 2664');
 assert.equal(new URL(links.email).protocol,'mailto:');
 assert.equal(decodeURIComponent(new URL(links.email).pathname),'felipehangen@gmail.com');
 assert.equal(window.ArenalListing.contactLinks({...d,draftPreview:true}),null);
 const html=window.ArenalListing.contactContent(d);
 for(const text of ['Felipe','felipehangen@gmail.com','+506 8854 2664','WhatsApp','demostración'])assert.ok(html.includes(text));
 assert.doesNotMatch(window.ArenalListing.contactContent({...d,details:{...d.details,contact:{...d.details.contact,name:'<script>bad</script>'}}}),/<script>/);
});

test('the shared public contact reaches every current demo without changing real listings or the stored data',()=>{
 const window={};
 for(const file of ['config.js','catalog.js'])vm.runInNewContext(read('site/'+file),{window});
 const before=JSON.stringify(rows);
 for(const row of rows){
  const contact=window.ArenalData.normalize(row).details.contact;
  assert.equal(contact.name,'Felipe');assert.equal(contact.whatsapp,'50688542664');
  assert.equal(contact.phone,'50688542664');assert.equal(contact.email,'equipo@arenalindex.com');
 }
 assert.equal(JSON.stringify(rows),before);
 assert.equal(window.ArenalData.normalize({...rows[0],is_demo:false}).details.contact,null);
 const real={...rows[0],is_demo:false,details:{...rows[0].details,contact:{name:'Other owner',whatsapp:'14155552671'}}};
 assert.equal(window.ArenalData.normalize(real).details.contact.whatsapp,'14155552671');
});
