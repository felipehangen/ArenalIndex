import * as M from './model.mjs?v=9-language';

// Only fixed interface labels are translated. Owner-written notes and names remain literal.
export function buyerCopy(draft,review={},language=globalThis.window?.ArenalI18n?.language||'es'){
  if(language!=='en')return M.buyerCopy(draft,review);
  const v=draft.values,t=s=>globalThis.window?.ArenalI18n?.t(s,{},'en')||s;
  const numeric=value=>Number(value)>0&&Number.isFinite(Number(value))?Number(value):null;
  const format=value=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(Number(value));
  const fields=M.steps.flatMap(s=>s.fields),field=id=>fields.find(f=>f.id===id);
  const answer=id=>{const f=field(id),value=M.label(f,v[id]);return f.options?t(value):value;};
  const known=id=>v[id]!==undefined&&v[id]!==''&&v[id]!=='unknown';
  const documented=numeric(review.documented_area)||numeric(v.documented_area),area=documented||numeric(v.area);
  const parts=[],add=(title,value)=>{if(value)parts.push(title+': '+value);};
  const title=v.listing_language==='en'?v.listing_title:v.listing_title_translation||v.listing_title;
  if(title?.trim())parts.push(title.trim());
  parts.push((area?'Land: '+format(area)+' m²':'Land area to be confirmed')+(M.hasBuildings(v)?' · '+draft.buildings.length+' building(s)':v.buildings==='no'?' · No buildings':' · Buildings to be confirmed'));
  if(area)parts.push(documented?(review.plan_matches?'Area from the reviewed survey plan.':'Area indicated on the survey plan; awaiting review.'):'Area stated by the seller.');
  parts.push('Information below is provided by the seller unless a different source is stated. Permitted uses, water-use rights and building permissions require separate review.');
  for(const id of ['current_use','terrain','usable','road','access','private_length','private_surface','legal_access','driveway','driveway_surface','directions','water','water_provider','water_date','well','water_rights','waterbody','electricity','electric_provider','internet','internet_technology','mobile','mobile_operator','mobile_network','sewage','rainwater','volcano','residential','fees']){
    const f=field(id);if(!M.visible(f,v))continue;
    if(known(id))add(t(f.label),answer(id));
    else if(['water','electricity','terrain'].includes(id))add(t(f.label),'To be confirmed');
  }
  if(numeric(v.usable))parts.push('The relatively flat area is an observation, not an approved buildable area.');
  if(v.water==='documented')parts.push('Confirm the water availability letter’s validity and scope with its issuer.');
  if(v.well==='yes')parts.push('Well drinking-water quality and water-use rights are unconfirmed.');
  if(v.waterbody&&v.waterbody!=='unknown'&&v.waterbody!=='No se reporta')parts.push('A watercourse does not establish water-use rights.');
  if(v.water_rights==='document')parts.push('The seller reports having a water-use document; review is pending.');
  for(const id of ['water','electricity'])if(known(id))add(t(field(id).label)+' — source',v[id+'_source']==='observed'?'Observation reported by the seller':v[id+'_source']==='document'?'Documentation reported by the seller':'Seller-provided information');
  if(M.hasBuildings(v))for(const [index,b] of draft.buildings.entries()){
    const facts=[b.name||'Building '+(index+1)];
    for(const f of M.buildingFields.filter(f=>!['name','notes'].includes(f.id))){if(b[f.id]!==undefined&&b[f.id]!=='')facts.push(t(f.label)+': '+(f.options?t(M.label(f,b[f.id])):b[f.id]));}
    parts.push(facts.join(' · '));
  }
  for(const id of ['landuse_status','landuse_date','landuse_activity','tax_status','tax_date'])if(known(id))add(t(field(id).label),answer(id));
  if(draft.files.some(f=>f.category==='landuse_file')||v.landuse_status==='available')parts.push('Land-use certificate '+(draft.files.some(f=>f.category==='landuse_file')?'provided':'reported by the seller')+'. Its scope remains subject to review; it does not authorize every use.');
  if(numeric(v.price)&&['USD','CRC'].includes(v.currency)){
    const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:v.currency,maximumFractionDigits:2}).format(n)+' '+v.currency;
    add('Asking price',money(Number(v.price)));if(documented)add('Price per m² of land',money(Number(v.price)/documented)+' (based on the area indicated on the survey plan)');
  }
  for(const id of ['negotiable','financing','terms'])if(known(id))add(t(field(id).label),answer(id));
  const notes=concerns(draft,review,'en');if(notes.length)parts.push('Conditions to consider:\n'+notes.map(note=>'• '+note).join('\n'));
  return parts.join('\n\n');
}
export function concerns(draft,review={},language=globalThis.window?.ArenalI18n?.language||'es'){
  if(language!=='en')return M.knownConcerns(draft,review);
  const t=s=>globalThis.window?.ArenalI18n?.t(s,{},'en')||s;
  const seller=[draft.values.land_notes,draft.values.water_notes,draft.values.services_notes,...(M.hasBuildings(draft.values)?draft.buildings.map(b=>b.notes):[])].filter(v=>typeof v==='string'&&v.trim());
  return [...seller,...M.inspectionItems.filter(item=>!item.building||M.hasBuildings(draft.values)).flatMap(item=>{
    const f=review.inspection?.[item.id];return ['reported','observed'].includes(f?.state)?[t(item.label)+' ('+(f.state==='observed'?'observed by ArenalIndex':'reported by the seller')+')'+(f.note?': '+f.note:'')]:[];
  })];
}
