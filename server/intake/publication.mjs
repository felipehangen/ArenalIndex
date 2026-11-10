import {steps, buildingFields, buildingName, label, visible, pending, photoTour, photoCaption, knownConcerns} from '../../site/newlisting/model.mjs';
import {createHash} from 'node:crypto';

const trim=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
const field=id=>steps.flatMap(step=>step.fields).find(f=>f.id===id);
const source=value=>value==='observed'?'Observación del vendedor':value==='document'?'Documento indicado por el vendedor':'Información del vendedor';

// A public listing is a deliberate projection, never a copy of a private record.
export function createPublication(row, editorial, {apiURL, date=new Date().toISOString()}={}) {
  if(row.status!=='approved'||pending(row.payload,{publication:true,review:row.review}).length)throw Error('Aprobá esta versión antes de publicarla.');
  const name=trim(editorial.title,160),place=trim(editorial.place,100),whatsapp=trim(editorial.whatsapp,30).replace(/[\s()+-]/g,'');
  if(!name||[...name].length>45||/[\p{Extended_Pictographic}\r\n]/u.test(name)||(/\p{Ll}/u.test(name)===false&&/\p{Lu}/u.test(name)))throw Error('Usá un título de hasta 45 caracteres, sin emojis ni mayúsculas sostenidas.');
  const language=editorial.language??row.payload.values.listing_language??'es',titleTranslation=trim(editorial.titleTranslation,160),descriptionTranslation=trim(editorial.descriptionTranslation,1200);
  if(!['es','en'].includes(language))throw Error('Elegí Español o English como idioma del título.');
  if(titleTranslation&&([...titleTranslation].length>45||/[\p{Extended_Pictographic}\r\n]/u.test(titleTranslation)||(!/\p{Ll}/u.test(titleTranslation)&&/\p{Lu}/u.test(titleTranslation))))throw Error('La traducción del título debe tener hasta 45 caracteres, sin emojis ni mayúsculas sostenidas.');
  if(!place)throw Error('Indicá la localidad del anuncio.');
  if(whatsapp&&!/^[1-9]\d{7,14}$/.test(whatsapp))throw Error('El WhatsApp público debe incluir el código de país.');
  const draft=row.payload,v=draft.values,r=row.review,media={};
  const answer=id=>{const f=field(id);return f&&visible(f,v)&&v[id]!==undefined&&v[id]!==''?label(f,v[id]):'';};
  const fact=(id,title,unit='')=>{const value=answer(id);return value?{label:title||field(id).label,value:value+(value!=='No confirmado'&&unit?unit:''),source:source(v[id+'_source']),...(!field(id).options?{literal:true}:{})}:null;};
  const section=(id,title,ids)=>({id,title,rows:ids.map(item=>fact(...(Array.isArray(item)?item:[item]))).filter(Boolean)});
  const groups=photoTour(draft).map(group=>({id:group.id,title:group.title,photos:group.files.map(file=>{
    media[file.id]={path:row.file_paths?.[file.id]||row.id+'/'+row.version+'/'+file.id,type:file.type,size:file.size};
    const url=new URL(apiURL);url.search=new URLSearchParams({id:row.id,photo:file.id,version:String(row.version)}).toString();
    return {id:file.id,src:url.href,caption:photoCaption(file,draft),perspective:file.perspective};
  })}));
  const all=groups.flatMap(g=>g.photos),cover=all.find(p=>p.id===v.cover_id)||all[0];
  const sections=[
    section('land','El terreno',[['current_use','Uso actual'],['terrain','Topografía'],['usable','Área relativamente plana observada',' m²'],['inspected','Recorrido del terreno'],['volcano','Vista al volcán desde el suelo'],['waterbody','Río, quebrada o naciente']]),
    section('access','Llegada y acceso',[['road','Vía de llegada'],['access','Hasta la entrada'],['private_length','Tramo privado',' m'],['private_surface','Superficie del tramo privado'],['legal_access','Derecho de paso'],['driveway','Camino dentro de la propiedad'],['driveway_surface','Superficie del camino interno'],['directions','Indicaciones para llegar']]),
    section('services','Servicios e infraestructura',[['water','Agua de red'],['water_provider','Proveedor de agua'],['water_date','Fecha de carta de disponibilidad'],['well','Pozo'],['water_rights','Respaldo de uso de agua'],['electricity','Electricidad'],['electric_provider','Proveedor eléctrico'],['internet','Internet fijo'],['internet_technology','Tecnología de internet'],['mobile','Señal celular'],['mobile_operator','Operador'],['mobile_network','Red celular'],['sewage','Aguas residuales'],['rainwater','Drenaje']]),
    section('community','Residencial o condominio',[['residential','Tipo de desarrollo'],['fees','Cuota indicada']]),
    section('documents','Información documental',[['landuse_status','Certificado de uso de suelo'],['landuse_date','Fecha del certificado'],['landuse_activity','Actividad consultada'],['tax_status','Impuestos municipales'],['tax_date','Fecha de información tributaria']]),
    section('sale','Condiciones de venta',[['negotiable','Precio negociable'],['financing','Financiamiento del vendedor'],['terms','Incluido y condiciones de venta']])
  ];
  sections.find(s=>s.id==='documents').rows.unshift({label:'Área del plano',value:Number(r.documented_area).toLocaleString('en-US')+' m²',source:'Plano revisado por ArenalIndex'});
  const buildings=v.buildings==='yes'?draft.buildings.map((b,index)=>({id:b.id,name:buildingName(b,index),rows:buildingFields.filter(f=>!['id','name','notes'].includes(f.id)&&b[f.id]!==undefined&&b[f.id]!=='').map(f=>({label:f.label,value:label(f,b[f.id])+(f.id==='area'?' m²':''),source:'Información del vendedor'}))})):[];
  const description=trim(editorial.description,1200);
  const listing={id:'ai-'+createHash('sha256').update(row.id).digest('hex').slice(0,24),name,description,place,price:Number(v.price),currency:v.currency,area:Number(r.documented_area),lat:Number(v.lat),lng:Number(v.lng),
    house:buildings.length>0,volcano:['Completa','Parcial'].includes(v.volcano),river:v.waterbody==='Colindante',water:['active','documented'].includes(v.water),electricity:v.electricity==='active',well:v.well==='yes',private_residential:v.residential==='condo',approximate:false,is_demo:false,
    images:cover?[cover,...all.filter(p=>p!==cover)].map(p=>p.src):[],
    details:{schemaVersion:1,language,translations:{[language]:{title:name,description},[language==='es'?'en':'es']:{...(titleTranslation?{title:titleTranslation}:{}),...(descriptionTranslation?{description:descriptionTranslation}:{})}},sections,buildings,photoGroups:groups,conditions:knownConcerns(draft,r),declaredArea:Number(v.area),documentedArea:Number(r.documented_area),areaSource:'Área del plano revisado',entrance:true,residential:v.residential||'unknown',contact:whatsapp?{whatsapp}:null,reviewedAt:row.reviewed_at,publishedAt:date}};
  if(row.is_demo===true){
    // Trusted record metadata survives edits; submitted form fields cannot set it.
    listing.is_demo=true;
    if(/^lot-[0-9]{1,6}$/.test(row.demo_source_id||''))listing.id=row.demo_source_id;
    listing.approximate=true;listing.details.entrance=false;listing.details.areaSource='Área de ejemplo';
    delete listing.details.reviewedAt;delete listing.details.publishedAt;
    const disclosure='Anuncio ficticio de demostración. No es una oferta de venta.';
    listing.details.conditions=[disclosure,...listing.details.conditions];
    for(const section of [...listing.details.sections,...listing.details.buildings])for(const fact of section.rows){fact.source='Dato ficticio de demostración';delete fact.literal;}
    for(const group of listing.details.photoGroups)for(const photo of group.photos)photo.caption='Imagen ilustrativa · '+photo.caption;
  }
  return {version:row.version,listing,media};
}
