import {steps,buildingFields,buildingName,label,visible,photoTour,photoCaption,knownConcerns,validPoint,hasBuildings} from './model.mjs?v=9-language';

const positive=value=>typeof value==='string'&&value.trim()&&Number.isFinite(Number(value))&&Number(value)>0?Number(value):null;

// A private, browser-only projection. Contact, documents, tokens and private notes
// are never handed to the buyer-facing renderer.
export function createDraftPreview(draft,urlFor){
  const v=draft.values,field=id=>steps.flatMap(step=>step.fields).find(f=>f.id===id);
  const fact=(id,title,unit='')=>{
    const f=field(id);
    if(!f||!visible(f,v)||v[id]===undefined||v[id]==='')return null;
    const value=label(f,v[id]);
    return {label:title||f.label,value:value+(value!=='No confirmado'?unit:''),...(!f.options?{literal:true}:{}),source:v[id+'_source']==='observed'?'Observación del vendedor':v[id+'_source']==='document'?'Documento indicado por el vendedor':'Información del vendedor'};
  };
  const section=(id,title,ids)=>({id,title,rows:ids.map(item=>fact(...(Array.isArray(item)?item:[item]))).filter(Boolean)});
  const sections=[
    section('land','El terreno',[['current_use','Uso actual'],['terrain','Topografía'],['usable','Área relativamente plana observada',' m²'],['inspected','Recorrido del terreno'],['volcano','Vista al volcán desde el suelo'],['waterbody','Río, quebrada o naciente']]),
    section('access','Llegada y acceso',[['road','Vía de llegada'],['access','Hasta la entrada'],['private_length','Tramo privado',' m'],['private_surface','Superficie del tramo privado'],['legal_access','Derecho de paso'],['driveway','Camino dentro de la propiedad'],['driveway_surface','Superficie del camino interno'],['directions','Indicaciones para llegar']]),
    section('services','Servicios e infraestructura',[['water','Agua de red'],['water_provider','Proveedor de agua'],['water_date','Fecha de carta de disponibilidad'],['well','Pozo'],['water_rights','Respaldo de uso de agua'],['electricity','Electricidad'],['electric_provider','Proveedor eléctrico'],['internet','Internet fijo'],['internet_technology','Tecnología de internet'],['mobile','Señal celular'],['mobile_operator','Operador'],['mobile_network','Red celular'],['sewage','Aguas residuales'],['rainwater','Drenaje']]),
    section('community','Residencial o condominio',[['residential','Tipo de desarrollo'],['fees','Cuota indicada']]),
    section('documents','Información documental',[['landuse_status','Certificado de uso de suelo'],['landuse_date','Fecha del certificado'],['landuse_activity','Actividad consultada'],['tax_status','Impuestos municipales'],['tax_date','Fecha de información tributaria']]),
    section('sale','Condiciones de venta',[['negotiable','Precio negociable'],['financing','Financiamiento del vendedor'],['terms','Incluido y condiciones de venta']])
  ];
  const documentedArea=positive(v.documented_area),declaredArea=positive(v.area),area=documentedArea||declaredArea;
  if(documentedArea)sections.find(s=>s.id==='documents').rows.unshift({label:'Área del plano',value:documentedArea.toLocaleString('en-US')+' m²',source:'Área indicada por el vendedor; pendiente de revisión'});
  for(const s of sections)if(!s.rows.length)s.rows.push({label:s.title,value:'Por completar',source:'Borrador del vendedor'});
  const buildings=hasBuildings(v)?draft.buildings.map((b,index)=>({id:b.id,name:buildingName(b,index),rows:buildingFields.filter(f=>!['name','notes'].includes(f.id)&&b[f.id]!==undefined&&b[f.id]!=='').map(f=>({label:f.label,value:label(f,b[f.id])+(f.id==='area'?' m²':''),source:'Información del vendedor'}))})):[];
  const photoGroups=photoTour(draft).map(group=>({id:group.id,title:group.title,photos:group.files.map(file=>({id:file.id,src:urlFor(file),caption:photoCaption(file,draft),perspective:file.perspective}))}));
  const photos=photoGroups.flatMap(group=>group.photos),cover=photos.find(photo=>photo.id===v.cover_id),ordered=cover?[cover,...photos.filter(photo=>photo!==cover)]:photos;
  const currency=['USD','CRC'].includes(v.currency)?v.currency:null;
  const language=v.listing_language==='en'?'en':'es',other=language==='es'?'en':'es';
  return {id:'draft-preview',name:v.listing_title?.trim()||'Título por definir',description:'',place:'Localidad por definir',draftPreview:true,
    price:positive(v.price),currency,area,coordinates:validPoint(v)?[Number(v.lng),Number(v.lat)]:null,
    house:hasBuildings(v),buildingsKnown:['yes','no'].includes(v.buildings),volcano:['Completa','Parcial'].includes(v.volcano),river:v.waterbody==='Colindante',water:['active','documented'].includes(v.water),electricity:v.electricity==='active',well:v.well==='yes',
    privateResidential:v.residential==='condo',approximate:v.exact!==true,isDemo:false,images:ordered.map(photo=>photo.src),icon:hasBuildings(v)?'house':'trees',
    details:{schemaVersion:1,language,translations:{[other]:{title:v.listing_title?.trim()?v.listing_title_translation?.trim()||'':''}},sections,buildings,photoGroups,conditions:knownConcerns(draft),declaredArea,documentedArea,areaSource:documentedArea?'Área indicada del plano · sin revisar':declaredArea?'Área declarada por el vendedor':'Área por completar',entrance:v.exact===true,residential:v.residential||'unknown',contact:null}};
}
