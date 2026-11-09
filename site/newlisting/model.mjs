export const VERSION = 3;
export const MAX_FILE = 12 * 1024 * 1024;
export const MAX_TOTAL = 60 * 1024 * 1024;
export const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const STATES = {draft:'Borrador', ready_for_review:'Lista para revisión de publicación', changes_requested:'Cambios solicitados', approved:'Aprobada para publicar', published:'Publicada'};
const options = rows => [['','Elegí una respuesta'], ...rows.map(row => Array.isArray(row) ? row : [row,row]), ['unknown','No confirmado']];
const select = (id,label,rows,extra={}) => ({id,label,type:'select',options:options(rows),...extra});
const text = (id,label,extra={}) => ({id,label,type:'text',maxLength:120,...extra});
const number = (id,label,extra={}) => ({id,label,type:'number',min:0,max:999999999,step:'any',...extra});
const note = (id,label) => text(id,label,{type:'textarea',maxLength:500,optional:true,wide:true});
const check = (id,label) => ({id,label,type:'checkbox',wide:true});
const group = (label,help='') => ({type:'group',label,help});
const when = (key,values) => ({key,values});
export const buildingFields = [
  select('kind','Tipo de construcción',[['house','Casa'],['cabin','Cabaña'],['commercial','Local comercial'],['storage','Bodega / construcción agrícola'],['other','Otra']]),
  text('name','Referencia opcional',{maxLength:40,optional:true,placeholder:'Ej. Casa principal'}),
  number('area','Área construida (m²)',{min:1,optional:true}),
  select('area_source','Fuente de esa medida',['Plano / documento','Medición','Estimación del propietario'],{optional:true}),
  number('bedrooms','Habitaciones',{step:1,optional:true}),
  number('bathrooms','Baños',{step:.5,optional:true}),
  select('condition','Estado observado',['Bueno','Necesita mantenimiento','Necesita reparaciones importantes'],{optional:true}),
  note('notes','Algo que debamos saber de esta construcción')
];
export const steps = [
  {id:'property',short:'La propiedad',title:'Todo empieza con el terreno.',lead:'Completá lo que sepás. Podés guardar el borrador y volver después.',fields:[
    select('buildings','¿Incluye construcciones?',[['yes','Sí'],['no','No']],{required:true}),
    text('name','Referencia para reconocerla',{maxLength:60,optional:true,placeholder:'Ej. Terreno de don Carlos'}),
    select('current_use','¿Cómo se utiliza hoy?',['Sin uso','Vivienda','Cultivos o ganadería','Recreación / descanso','Alojamiento turístico','Comercio','Otro'],{optional:true}),
    note('intro','Algún detalle que no encaje en las opciones')
  ]},
  {id:'location',short:'La entrada',title:'Marcá la entrada de la propiedad.',lead:'El pin siempre representa la entrada. Acercá el mapa y colocá el punto; también podés ingresar coordenadas.',fields:[
    number('lat','Latitud',{min:-90,max:90}),number('lng','Longitud',{min:-180,max:180}),
    select('location_method','¿Cómo ubicamos esta entrada?',[['map','La reconozco en el mapa'],['gps','GPS desde la entrada'],['coordinates','Coordenadas proporcionadas'],['plan','Referencia del plano']]),
    check('exact','Confirmo que el pin está en la entrada correcta.'),
    note('directions','Indicaciones útiles para llegar')
  ]},
  {id:'land',short:'Terreno y acceso',title:'Cómo es y cómo se llega.',lead:'Una respuesta desconocida puede quedar como “No confirmado”. Las notas son opcionales.',fields:[
    group('El terreno','El plano será la referencia del área al preparar la publicación.'),
    number('area','Área total del terreno (m²)',{min:1,required:true}),
    select('terrain','Topografía',['Mayormente plano','Mayormente inclinado','Mixto'],{required:true}),
    select('inspected','¿Se ha recorrido todo el terreno?',[['yes','Sí'],['no','Solo una parte']],{optional:true}),
    number('usable','Área relativamente plana observada (m²)',{optional:true,help:'Una observación; no equivale a área construible autorizada.'}),
    group('Cómo se llega'),
    select('road','Superficie de la vía de llegada',['Asfalto / concreto','Lastre','Tierra','Mixto'],{required:true}),
    select('access','Acceso a la propiedad',[['direct','Directo desde la vía de llegada'],['private','Por camino privado / servidumbre']],{required:true}),
    number('private_length','Tramo privado o sin pavimentar (m)',{optional:true}),
    select('private_surface','Superficie de ese tramo',['Asfalto / concreto','Lastre','Tierra','Mixto'],{optional:true,when:when('access',['private'])}),
    select('legal_access','Respaldo del derecho de acceso',[['supplied','Documento disponible'],['unverified','No verificado']],{optional:true}),
    group('Entorno'),
    select('volcano','Vista al volcán desde el suelo',['Completa','Parcial','No tiene'],{optional:true}),
    select('waterbody','Río, quebrada o naciente',['Dentro de la propiedad','Colindante','Cerca, fuera de la propiedad','No se reporta'],{optional:true}),
    select('residential','Residencial o condominio',[['no','No'],['residential','Residencial privado'],['condo','Condominio']],{optional:true}),
    text('fees','Cuota y moneda',{optional:true,when:when('residential',['residential','condo'])}),
    note('land_notes','Acceso, lluvias o condiciones que conviene conocer')
  ]},
  {id:'services',short:'Servicios',title:'Un servicio, una respuesta clara.',lead:'No necesitás conseguir certificados para responder. Tus respuestas se registran como información del vendedor.',fields:[
    group('Agua'),
    select('water','Estado del suministro público o comunitario',[['active','Conexión activa'],['inactive','Conexión existente, inactiva'],['documented','Carta de disponibilidad'],['nearby','Red cercana, disponibilidad sin confirmar'],['none','Sin suministro público o comunitario confirmado']],{required:true}),
    text('water_provider','Proveedor',{optional:true,when:when('water',['active','inactive','documented','nearby'])}),
    text('water_date','Fecha de la carta',{type:'date',optional:true,when:when('water',['documented'])}),
    select('well','¿Hay pozo?',[['yes','Sí'],['no','No']],{optional:true}),
    note('water_notes','Aclaraciones sobre agua, pozo o naciente'),
    group('Electricidad'),
    select('electricity','Estado del servicio eléctrico',[['active','Medidor activo'],['inactive','Medidor inactivo'],['nearby','Red cercana, conexión sin confirmar'],['none','No se conoce red disponible']],{required:true}),
    text('electric_provider','Proveedor',{optional:true,when:when('electricity',['active','inactive','nearby'])}),
    group('Internet y señal celular · opcional'),
    select('internet','Internet fijo',[['installed','Instalado'],['confirmed','Proveedor confirma disponibilidad'],['none','No se conoce servicio']],{optional:true}),
    select('internet_technology','Tecnología',['Fibra','Cable','Internet inalámbrico fijo','Satelital'],{optional:true,when:when('internet',['installed','confirmed'])}),
    select('mobile','Cobertura celular',[['tested','Probada en el sitio'],['reported','Reportada, sin probar'],['none','No se detectó cobertura']],{optional:true}),
    select('mobile_operator','Operador probado',['Kölbi','Claro','Liberty','Varios'],{optional:true,when:when('mobile',['tested'])}),
    group('Saneamiento y lluvia · opcional'),
    select('sewage','Aguas residuales',['Tanque séptico','Planta de tratamiento','Alcantarillado sanitario','No hay sistema instalado'],{optional:true}),
    select('rainwater','Drenaje observado',['Escurre por pendiente natural','Hay cunetas o drenajes','Se acumula en algunas zonas'],{optional:true}),
    note('services_notes','Limitaciones o detalles de los servicios')
  ]},
  {id:'buildings',short:'Construcciones',title:'Cada construcción, por separado.',lead:'Identificá lo que incluye la venta. Las medidas y los detalles pueden completarse después.',fields:[]},
  {id:'photos',short:'Fotos',title:'Prepará un recorrido claro.',lead:'Mostrá el terreno y cómo llegar. Elegí una portada entre tus fotos. No necesitás escribir pies de foto.',fields:[
    note('photo_exception','Si falta alguna toma, explicá por qué para que podamos revisarlo')
  ]},
  {id:'documents',short:'Documentos',title:'El plano y lo que ya tengás.',lead:'Necesitamos el plano antes de publicar. Podés guardar un borrador mientras lo conseguís. Adjuntar un documento no significa que haya sido verificado.',fields:[
    text('plan','Número de plano',{optional:true,maxLength:40,help:'Podemos confirmar la transcripción al revisar el documento.'}),
    number('documented_area','Área que indica el plano (m²)',{optional:true,min:1}),
    text('landuse_date','Fecha del uso de suelo',{type:'date',optional:true}),
    text('landuse_activity','Actividad a la que se refiere',{optional:true}),
    select('tax_status','Impuestos municipales',[['current','Al día, según información disponible'],['overdue','Con pendientes'],['unverified','No verificado']],{optional:true}),
    text('tax_date','Fecha de esa información',{type:'date',optional:true}),
    note('documents_notes','Diferencias de área, documentos o asuntos pendientes')
  ]},
  {id:'review',short:'Venta y envío',title:'Revisá y enviá tu propuesta.',lead:'ArenalIndex revisará la ficha antes de publicar. Podés corregirla o dejarla guardada como borrador.',fields:[
    group('Precio'),
    number('price','Precio de venta',{min:1,step:1,required:true}),
    select('currency','Moneda',[['USD','Dólares (USD)'],['CRC','Colones (CRC)']],{required:true,known:true}),
    select('negotiable','¿Es negociable?',['Sí','No','Consultar'],{optional:true}),
    select('financing','¿Ofrecés financiamiento?',['Sí','No','Consultar'],{optional:true}),
    note('terms','Condiciones o elementos incluidos en la venta'),
    group('Persona responsable','Solo necesitamos un medio de contacto. Se usa para revisar esta propuesta.'),
    text('contact','Nombre',{maxLength:80,required:true}),
    text('phone','Teléfono / WhatsApp',{type:'tel',maxLength:25}),
    text('email','Correo electrónico',{type:'email',maxLength:120}),
    select('role','Tu relación con la propiedad',[['owner','Propietario'],['representative','Representante autorizado']],{required:true,known:true}),
    group('Autorizaciones'),
    check('authorization','Soy propietario o representante autorizado y autorizo publicar esta información después de la aprobación de ArenalIndex.'),
    check('location_consent','Autorizo mostrar la ubicación precisa de la entrada en el anuncio.'),
    check('photo_permission','Tengo permiso para usar estas fotografías en el anuncio.')
  ]}
];
export const photoGroups = [
  {id:'land',title:'Terreno',help:'Dos vistas distintas del terreno: conjunto, relieve y vegetación.',min:2},
  {id:'access',title:'Llegada y acceso',help:'Una foto de la entrada y otra de la vía de llegada.',min:2},
  {id:'surroundings',title:'Entorno y vistas',help:'Paisaje y vistas desde el suelo. El dron puede complementar.',min:0},
  {id:'infrastructure',title:'Infraestructura',help:'Instalaciones existentes: agua, electricidad y drenaje.',min:0},
  {id:'buildings',title:'Construcciones',help:'Un exterior de cada construcción; interiores cuando estén disponibles.',min:0,building:true}
];
export const documentGroups = [
  {id:'plan_file',title:'Plano catastrado',help:'Una copia legible, con número y área.'},
  {id:'registry_file',title:'Información registral',help:'Opcional. Su recepción no verifica la titularidad.'},
  {id:'water_file',title:'Disponibilidad de agua',help:'Carta o respaldo disponible. Opcional.'},
  {id:'landuse_file',title:'Uso de suelo',help:'Documento, fecha y actividad consultada. Opcional.'},
  {id:'tax_file',title:'Impuestos municipales',help:'Respaldo disponible. Opcional.'},
  {id:'permits_file',title:'Planos y permisos de obra',help:'Documentos de las construcciones. Opcional.',building:true},
  {id:'technical',title:'Revisión interna',help:'Detalles y observaciones para revisar; no forman una sección pública.'},
  {id:'other_file',title:'Otros respaldos',help:'Acceso, reglamento u otra información pertinente.'}
];
export const hasBuildings = values => values.buildings === 'yes';
export const visible = (field,values) => !field.when || field.when.values.includes(values[field.when.key]);
export const activeSteps = draft => steps.map((_,i)=>i).filter(i=>i!==4||hasBuildings(draft.values));
export const activeGroups = values => [...photoGroups,...documentGroups].filter(g=>!g.building||hasBuildings(values));
export const validPoint = values => ['lat','lng'].every((key,i)=>typeof values[key]==='string'&&values[key].trim()!==''&&Number.isFinite(Number(values[key]))&&Math.abs(Number(values[key]))<=[90,180][i]);
export const label = (field,value) => field.type==='checkbox' ? (value?'Sí':'Pendiente') : field.options?.find(o=>o[0]===value)?.[1] || value || 'Pendiente';
export const reference = draft => draft.values.name?.trim() || 'Terreno · '+draft.id.slice(0,8).toUpperCase();
export const pricePerArea = values => Number(values.price)>0&&Number(values.documented_area)>0 ? Number(values.price)/Number(values.documented_area) : null;
export function newDraft(id=globalThis.crypto.randomUUID()) {
  return {version:VERSION,id,values:{},buildings:[],files:[],step:0,updated:'',submission:null,revision:0};
}
const aliases = {
  water:{'Conexión activa con medidor':'active','Conexión existente sin servicio activo':'inactive','Disponibilidad documentada':'documented','Red cercana, sin confirmar disponibilidad':'nearby','No tiene':'none','Pozo o naciente como abastecimiento':'none'},
  electricity:{'Medidor y servicio activo':'active','Instalación existente sin servicio activo':'inactive','Disponibilidad documentada':'nearby','Red cercana, conexión pendiente':'nearby','No tiene':'none'},
  access:{'Calle pública':'direct','Servidumbre':'private','Otro / por aclarar':'unknown'},
  terrain:{'Plano':'Mayormente plano','Pendiente suave':'Mayormente inclinado','Pendiente fuerte':'Mayormente inclinado'},
  road:{'Asfalto':'Asfalto / concreto','Concreto':'Asfalto / concreto'},
  internet:{'Instalado':'installed','Cobertura confirmada por proveedor':'confirmed','Cobertura por consultar':'unknown','No tiene':'none'},
  role:{'Propietario':'owner','Corredor':'representative','Representante autorizado':'representative','Equipo ArenalIndex':'representative'}
};
export function normalizeDraft(input,id) {
  const d={...newDraft(id||input.id),...input,version:VERSION,values:{...input.values},buildings:Array.isArray(input.buildings)?input.buildings.map(b=>({...b})):[]};
  const v=d.values;
  if(!v.buildings) v.buildings=['built_land','home','business','Terreno con casa','Casa','Negocio turístico'].includes(v.type)?'yes':['land','Lote','Finca','Quinta'].includes(v.type)?'no':'';
  if(input.version!==VERSION) {
    d.legacyValues={...(input.legacyValues||{}),...v};
    for(const [key,map] of Object.entries(aliases)) if(map[v[key]])v[key]=map[v[key]];
    for(const f of steps.flatMap(s=>s.fields)) if(f.options&&v[f.id]&&!f.options.some(o=>o[0]===v[f.id]))v[f.id]='unknown';
    v.land_notes=v.land_notes||v.land_evidence||v.rain||'';
    v.services_notes=v.services_notes||v.services_evidence||'';
    if(!d.buildings.length&&v.buildings==='yes')d.buildings=[{id:'legacy-building',kind:'other',name:'Construcción de la ficha anterior',area:v.built_area||'',bedrooms:v.bedrooms||'',bathrooms:v.bathrooms||'',notes:v.condition||''}];
  }
  const categories={overview:'land',flat:'land',entrance:'access',view:'surroundings',nature:'surroundings',aerial:'land',services:'technical',exterior:'buildings',living:'buildings',kitchen:'buildings',bedrooms:'buildings',bathrooms:'buildings',amenities:'buildings',interior:'buildings'};
  d.files=(input.files||[]).map(f=>({...f,category:categories[f.category]||f.category,shot:f.shot||(f.category==='entrance'?'entrance':f.category==='exterior'?'exterior':'general'),perspective:f.perspective||(f.category==='aerial'?'drone':'ground'),buildingId:f.buildingId||(['exterior','living','kitchen','bedrooms','bathrooms','amenities','interior'].includes(f.category)?d.buildings[0]?.id||'':'')}));
  d.step=Math.max(0,Math.min(7,Number.isInteger(d.step)?d.step:0));
  if(d.step===4&&!hasBuildings(v))d.step=5;
  return d;
}
function fieldIssues(field,value) {
  if(field.required&&(!value||(field.known&&value==='unknown')))return true;
  if(value===undefined||value==='')return false;
  if(field.type==='checkbox')return typeof value!=='boolean';
  if(typeof value!=='string'||value.length>(field.maxLength||500))return true;
  if(field.options&&!field.options.some(o=>o[0]===value))return true;
  if(field.type==='number')return value.trim()===''||!Number.isFinite(Number(value))||Number(value)<field.min||Number(value)>field.max||(field.step!=='any'&&Math.abs(Number(value)/field.step-Math.round(Number(value)/field.step))>1e-8);
  if(field.type==='date')return !/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value;
  if(field.type==='email')return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if(field.type==='tel')return value.replace(/\D/g,'').length<7;
  return false;
}
export function photoIssues(draft) {
  const images=draft.files.filter(f=>f.type?.startsWith('image/'));
  const issues=[];
  if(images.filter(f=>f.category==='land').length<2)issues.push('Dos fotos del terreno');
  if(!images.some(f=>f.category==='access'&&f.shot==='entrance'))issues.push('Una foto de la entrada');
  if(!images.some(f=>f.category==='access'&&f.shot==='road'))issues.push('Una foto de la vía de llegada');
  if(hasBuildings(draft.values))for(const b of draft.buildings)if(!images.some(f=>f.category==='buildings'&&f.buildingId===b.id&&f.shot==='exterior'))issues.push('Foto exterior: '+(b.name||'construcción'));
  return issues;
}
export function pending(draft,{publication=false,review={}}={}) {
  const v=draft.values,issues=[];
  steps.forEach((s,step)=>s.fields.filter(f=>f.id&&visible(f,v)).forEach(f=>{if(fieldIssues(f,v[f.id]))issues.push({label:f.label,step});}));
  if(!validPoint(v)||v.exact!==true)issues.push({label:'Entrada exacta confirmada en el mapa',step:1});
  if(!v.phone?.trim()&&!v.email?.trim())issues.push({label:'Un teléfono o correo de contacto',step:7});
  for(const [key,title] of [['authorization','Autorización de publicación'],['location_consent','Permiso para mostrar la entrada'],['photo_permission','Permiso de uso de fotografías']])if(v[key]!==true)issues.push({label:title,step:7});
  if(!draft.files.some(f=>f.category==='plan_file'))issues.push({label:'Copia del plano catastrado',step:6});
  if(hasBuildings(v)) {
    if(!draft.buildings.length)issues.push({label:'Agregar las construcciones incluidas',step:4});
    for(const b of draft.buildings){if(!b.kind||b.kind==='unknown')issues.push({label:'Tipo de cada construcción',step:4});for(const f of buildingFields)if(fieldIssues(f,b[f.id]))issues.push({label:f.label+' · '+(b.name||'construcción'),step:4});}
  }
  if(!v.photo_exception?.trim()||(publication&&!review.photo_exception_accepted))for(const title of photoIssues(draft))issues.push({label:title,step:5});
  const gallery=photoGroups.filter(g=>!g.building||hasBuildings(v)).map(g=>g.id);
  if(!draft.files.some(f=>f.id===v.cover_id&&gallery.includes(f.category)&&f.type?.startsWith('image/')))issues.push({label:'Elegir una foto de portada',step:5});
  if(publication) {
    if(!review.plan_number?.trim())issues.push({label:'Confirmar el número del plano',step:6});
    if(!(Number(review.documented_area)>0&&Number(review.documented_area)<1e9))issues.push({label:'Confirmar el área documentada',step:6});
    if(!review.plan_matches)issues.push({label:'Confirmar que el plano corresponde a la propiedad',step:6});
    if(Number(review.documented_area)!==Number(v.area)&&!review.discrepancy_resolved)issues.push({label:'Resolver la diferencia de área',step:6});
    if(!review.copy_checked)issues.push({label:'Revisar texto, fotos y condiciones conocidas',step:7});
    if(v.buildings==='unknown')issues.push({label:'Confirmar si la venta incluye construcciones',step:0});
  }
  return issues;
}
export function buyerCopy(draft,review={}) {
  const v=draft.values,area=Number(review.documented_area||v.documented_area||v.area);
  const parts=[(area>0?'Terreno de '+new Intl.NumberFormat('es-CR',{maximumFractionDigits:0}).format(area)+' m²':'Terreno con área por confirmar')+(hasBuildings(v)?' con '+draft.buildings.length+' construcción(es).':v.buildings==='no'?' sin construcciones.':'. Construcciones por confirmar.')];
  const lookup=id=>steps.flatMap(s=>s.fields).find(f=>f.id===id);
  for(const id of ['terrain','access','road','water','electricity']) {
    const f=lookup(id);
    parts.push(f.label+': '+(!v[id]||v[id]==='unknown'?'por confirmar.':label(f,v[id]).toLowerCase()+' (información del vendedor).'));
  }
  if(v.currency&&Number(v.price)>0)parts.push('Precio solicitado: '+new Intl.NumberFormat('es-CR',{style:'currency',currency:v.currency,maximumFractionDigits:0}).format(Number(v.price))+'.');
  if(Number(review.documented_area||v.documented_area)>0)parts.push('Precio por m² de terreno: '+new Intl.NumberFormat('es-CR',{style:'currency',currency:v.currency||'USD',maximumFractionDigits:2}).format(Number(v.price)/Number(review.documented_area||v.documented_area))+'.');
  return parts.join('\n\n');
}
export function knownConcerns(draft) {
  return [draft.values.land_notes,draft.values.services_notes,...(hasBuildings(draft.values)?draft.buildings.map(b=>b.notes):[])].filter(Boolean);
}
export function validSignature(type,bytes,size=bytes.length) {
  if(type==='image/jpeg')return size>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(type==='image/png')return size>=45&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b);
  if(type==='application/pdf')return size>=8&&String.fromCharCode(...bytes.slice(0,5))==='%PDF-';
  if(type==='image/webp')return size>=20&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  return false;
}
export function validateDraft(input) {
  if(!input||typeof input!=='object'||!input.values||Array.isArray(input.values)||!Array.isArray(input.files)||!Array.isArray(input.buildings))throw Error('La ficha no tiene un formato válido.');
  if(!/^[a-zA-Z0-9-]{8,80}$/.test(input.id||''))throw Error('Identificador de ficha inválido.');
  if(input.files.length>120||input.buildings.length>30)throw Error('Demasiados archivos o construcciones.');
  const fields=steps.flatMap(s=>s.fields).filter(f=>f.id),values={};
  for(const f of [...fields,{id:'cover_id',type:'text',maxLength:100}]) {
    const value=input.values[f.id];if(value===undefined)continue;
    if(f.type==='checkbox'){if(typeof value!=='boolean')throw Error('Respuesta inválida.');}
    else if(typeof value!=='string'||value.length>12000)throw Error('Campo inválido.');
    else if(f.options&&value!==''&&!f.options.some(o=>o[0]===value))throw Error('Opción inválida: '+f.label);
    values[f.id]=value;
  }
  const buildingIds=new Set(),buildings=input.buildings.map(b=>{
    if(!b||!/^[a-zA-Z0-9-]{1,80}$/.test(b.id||'')||buildingIds.has(b.id))throw Error('Construcción inválida.');
    buildingIds.add(b.id);const result={id:b.id};
    for(const f of buildingFields)if(b[f.id]!==undefined){if(typeof b[f.id]!=='string'||b[f.id].length>12000)throw Error('Dato de construcción inválido.');result[f.id]=b[f.id];}
    return result;
  });
  let total=0;const ids=new Set(),categories=[...photoGroups,...documentGroups].map(g=>g.id);
  const files=input.files.map(f=>{
    if(!f||!/^[a-zA-Z0-9-]{1,100}$/.test(f.id||'')||ids.has(f.id)||!categories.includes(f.category)||!TYPES.includes(f.type)||typeof f.name!=='string'||!f.name||f.name.length>255||!Number.isInteger(f.size)||f.size<1||f.size>MAX_FILE)throw Error('Archivo inválido.');
    if(photoGroups.some(g=>g.id===f.category)&&!f.type.startsWith('image/'))throw Error('El recorrido solo admite fotografías.');
    ids.add(f.id);total+=f.size;if(total>MAX_TOTAL)throw Error('Los archivos superan 60 MB.');
    return {id:f.id,name:f.name,type:f.type,size:f.size,category:f.category,shot:['entrance','road','exterior','interior','general'].includes(f.shot)?f.shot:'general',perspective:f.perspective==='drone'?'drone':'ground',buildingId:buildingIds.has(f.buildingId)?f.buildingId:'',caption:typeof f.caption==='string'?f.caption.slice(0,160):''};
  });
  return {version:VERSION,id:input.id,values,buildings,files};
}
export function importBackup(obj,id) {
  if(!obj||obj.format!=='arenalindex-intake'||![1,2,3].includes(obj.version))throw Error('Esta no es una copia de ArenalIndex.');
  const normalized=normalizeDraft({...obj,id:id||obj.id,submission:null},id);
  const decoded=normalized.files.map((f,i)=>{
    if(typeof f.data!=='string'||!f.data.startsWith('data:'+f.type+';base64,'))throw Error('Archivo inválido en la copia.');
    const encoded=f.data.slice(f.data.indexOf(',')+1);
    if(!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)||encoded.length%4)throw Error('Archivo incompleto.');
    if(encoded.length>MAX_FILE*4/3+4)throw Error('Archivo demasiado grande.');
    const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
    if(!validSignature(f.type,bytes,bytes.length))throw Error('No se reconoció el contenido de '+f.name+'.');
    const newId='restored-'+i;if(normalized.values.cover_id===f.id)normalized.values.cover_id=newId;
    return {...f,id:newId,size:bytes.length,blob:new Blob([bytes],{type:f.type})};
  });
  const validated=validateDraft({...normalized,files:decoded});
  return {...normalized,...validated,files:decoded,submission:null,revision:0,accessToken:undefined};
}
