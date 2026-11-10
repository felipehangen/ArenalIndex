import {newDraft,validateDraft,steps,buildingFields} from '../site/newlisting/model.mjs';

// Import existing illustrative data into the ordinary private editing workflow.
// Consent, location confirmation and documentary evidence stay for the account to supply.
export function demoWorkspace(listing,account,assets,{date=new Date().toISOString()}={}){
  if(listing.is_demo!==true||!/^lot-[0-9]{1,6}$/.test(listing.id)||!account.active||!account.subject)throw Error('Invalid demo workspace import');
  const id='workspace-demo-'+listing.id,draft=newDraft(id),facts=new Map((listing.details?.sections||[]).flatMap(s=>s.rows).map(f=>[f.label,f.value]));
  const fields=steps.flatMap(s=>s.fields);
  const answer=(id,value)=>{const f=fields.find(f=>f.id===id);return f?.options?f.options.find(o=>o[1]===value)?.[0]||'unknown':String(value??'');};
  draft.values={name:listing.name,listing_title_es:listing.details?.translations?.es?.title||listing.name,listing_title_en:listing.details?.translations?.en?.title||'',intro:listing.description||'',buildings:listing.house?'yes':'no',lat:String(listing.lat),lng:String(listing.lng),area:String(listing.area),price:String(listing.price),currency:listing.currency||'USD',contact:account.name,email:account.email,role:'representative',exact:false,authorization:false,location_consent:false,photo_permission:false};
  const mapping={current_use:'Uso actual',terrain:'Topografía',road:'Vía de llegada',access:'Hasta la entrada',driveway:'Camino dentro de la propiedad',volcano:'Vista al volcán desde el suelo',waterbody:'Río, quebrada o naciente',water:'Agua de red',electricity:'Electricidad',internet:'Internet fijo',sewage:'Aguas residuales',residential:'Tipo de desarrollo',negotiable:'Precio negociable',financing:'Financiamiento del vendedor'};
  for(const [id,label] of Object.entries(mapping))if(facts.has(label))draft.values[id]=answer(id,facts.get(label));
  draft.buildings=(listing.details?.buildings||[]).map(b=>{
    const facts=new Map(b.rows.map(f=>[f.label,f.value])),result={id:b.id,name:b.name};
    for(const f of buildingFields){let value=facts.get(f.label);if(value===undefined)continue;if(f.type==='number')value=String(value).replace(/\s*m²$/,'').replace(/,/g,'');result[f.id]=f.options?f.options.find(o=>o[1]===value)?.[0]||'unknown':String(value);}
    return result;
  });
  const filePaths={},media={};
  for(const group of listing.details?.photoGroups||[])for(const photo of group.photos){
    if(draft.files.some(file=>file.id===photo.id))continue;
    const asset=assets[photo.id];if(!asset?.size||!asset.path)throw Error('Missing imported photo '+photo.id);
    const building=draft.buildings.find(b=>group.id==='buildings-'+b.id);
    const category=building?'buildings':['land','access','surroundings'].includes(group.id)?group.id:'surroundings';
    draft.files.push({id:photo.id,name:photo.id+'.webp',type:'image/webp',size:asset.size,category,shot:building?'exterior':'general',buildingId:building?.id||'',perspective:photo.perspective,caption:photo.caption});
    filePaths[photo.id]=asset.path;media[photo.id]={path:asset.path,type:'image/webp',size:asset.size};
  }
  draft.values.cover_id=draft.files[0]?.id||'';
  const language=listing.details?.language||'es',translation=listing.details?.translations?.[language==='es'?'en':'es']||{};
  return {id,owner_subject:account.subject,owner_email:account.email,is_demo:true,demo_source_id:listing.id,payload:validateDraft(draft),file_paths:filePaths,status:'draft',version:1,edit_revision:0,publication_revision:1,updated_at:date,imported_at:date,last_save_id:'demo-workspace-import',review:{},editorial:{title:listing.name,place:listing.place,description:listing.description||'',language,titleTranslation:translation.title||'',descriptionTranslation:translation.description||'',whatsapp:listing.details?.contact?.whatsapp||''},publication:{version:1,listing:structuredClone(listing),media}};
}
