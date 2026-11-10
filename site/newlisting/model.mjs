export const VERSION = 3;
export const MAX_FILE = 12 * 1024 * 1024;
export const MAX_TOTAL = 60 * 1024 * 1024;
export const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const STATES = {draft:'Borrador', ready_for_review:'Lista para revisión de publicación', changes_requested:'Esperando cambios', approved:'Aprobada para publicar', published:'Publicada'};
const options = rows => [['','Elegí una respuesta'], ...rows.map(row => Array.isArray(row) ? row : [row,row]), ['unknown','No confirmado']];
const select = (id,label,rows,extra={}) => ({id,label,type:'select',options:options(rows),...extra});
const text = (id,label,extra={}) => ({id,label,type:'text',maxLength:120,...extra});
const number = (id,label,extra={}) => ({id,label,type:'number',min:0,max:999999999,step:'any',...extra});
const note = (id,label) => text(id,label,{type:'textarea',maxLength:500,optional:true,wide:true});
const check = (id,label) => ({id,label,type:'checkbox',wide:true});
const group = (label,help='',extra={}) => ({type:'group',label,help,...extra});
const when = (key,values) => ({key,values});
const source = id => select(id,'¿Cómo conocés ese dato?',[
  ['seller','Información del propietario'],['observed','Lo observé en el sitio'],['document','Figura en un documento']
],{optional:true,help:'Opcional. La fuente indicada no equivale a una verificación de ArenalIndex.'});
export const buildingFields = [
  select('kind','Tipo de construcción',[['house','Casa'],['cabin','Cabaña'],['commercial','Local comercial'],['storage','Bodega / construcción agrícola'],['other','Otra']]),
  text('name','Nombre para distinguirla',{maxLength:40,optional:true,prominent:true,placeholder:'Ej. Casa principal'}),
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
    text('name','Referencia privada para reconocerla',{maxLength:60,optional:true,prominent:true,placeholder:'Ej. Terreno de don Carlos',help:'Solo para identificar tu borrador y la revisión; no se muestra en el anuncio.'}),
    text('listing_title','Nombre corto sugerido para el anuncio',{maxLength:45,optional:true,prominent:true,placeholder:'Ej. Lote con vista al Arenal',help:'Hasta 45 caracteres. Describí un rasgo comprobable; evitá nombres personales, dirección exacta, precio, emojis y MAYÚSCULAS sostenidas. ArenalIndex decide el título definitivo durante la revisión.'}),
    {id:'listing_language',label:'Idioma del título',type:'select',options:[['es','Español'],['en','English']],optional:true,prominent:true},
    text('listing_title_translation','Traducción del título',{maxLength:45,optional:true,help:'Opcional: la versión en el otro idioma. ArenalIndex puede completarla durante la revisión.'}),
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
    select('access','¿Cómo se llega desde la vía hasta la entrada?',[['direct','La entrada da directamente a la vía'],['private','Hay que pasar por un camino privado o servidumbre']],{required:true,help:'Esta respuesta describe el trayecto hasta la entrada; el camino dentro de la propiedad se pregunta aparte.'}),
    group('Camino privado o servidumbre','Completá estos datos solo si hay un tramo entre la vía de llegada y la entrada.',{openWhen:when('access',['private'])}),
    number('private_length','Longitud de ese tramo privado (m)',{optional:true,when:when('access',['private'])}),
    select('private_surface','Superficie de ese tramo',['Asfalto / concreto','Lastre','Tierra','Mixto'],{optional:true,when:when('access',['private'])}),
    select('legal_access','Documento sobre el derecho de paso',[['supplied','Tengo un documento para revisar'],['unverified','No se ha verificado']],{optional:true,when:when('access',['private']),help:'La existencia del camino no confirma el derecho legal de paso.'}),
    group('Dentro de la propiedad'),
    select('driveway','¿Hay camino dentro de la propiedad?',[['yes','Sí'],['no','No']],{optional:true}),
    select('driveway_surface','Superficie del camino interno',['Asfalto / concreto','Lastre','Tierra','Mixto'],{optional:true,when:when('driveway',['yes'])}),
    group('Entorno'),
    select('volcano','Vista al volcán desde el suelo',['Completa','Parcial','No tiene'],{optional:true}),
    select('waterbody','Río, quebrada o naciente',['Dentro de la propiedad','Colindante','Cerca, fuera de la propiedad','No se reporta'],{optional:true}),
    select('residential','¿Está en un residencial o condominio?',[['no','No'],['residential','Residencial con vías públicas'],['condo','Condominio con áreas comunes privadas']],{optional:true,help:'Indicá el tipo de desarrollo según los documentos. La existencia de una aguja o portón se puede aclarar en las notas.'}),
    text('fees','Cuota de mantenimiento o asociación y moneda',{optional:true,when:when('residential',['residential','condo'])}),
    note('land_notes','Acceso, lluvias o condiciones que conviene conocer')
  ]},
  {id:'services',short:'Servicios',title:'Un servicio, una respuesta clara.',lead:'No necesitás conseguir certificados para responder. Tus respuestas se registran como información del vendedor.',fields:[
    group('Agua de red pública o comunitaria'),
    select('water','Estado del suministro público o comunitario',[['active','Conexión activa'],['inactive','Conexión existente, inactiva'],['documented','Carta de disponibilidad'],['nearby','Red cercana, disponibilidad sin confirmar'],['none','Sin suministro público o comunitario confirmado']],{required:true}),
    {...source('water_source'),label:'¿En qué basás la respuesta sobre agua de red?'},
    text('water_provider','Proveedor',{optional:true,when:when('water',['active','inactive','documented','nearby'])}),
    text('water_date','Fecha de la carta',{type:'date',optional:true,when:when('water',['documented'])}),
    group('Pozo o naciente'),
    select('well','¿Hay pozo?',[['yes','Sí'],['no','No']],{optional:true}),
    select('water_rights','Respaldo para usar agua de pozo o naciente',[['document','Tengo un documento para revisar'],['unverified','No se ha verificado'],['not_applicable','No aplica']],{optional:true,help:'La presencia de agua no confirma potabilidad ni derechos de uso.'}),
    note('water_notes','Aclaraciones sobre agua, pozo o naciente'),
    group('Electricidad'),
    select('electricity','Estado del servicio eléctrico',[['active','Medidor activo'],['inactive','Medidor inactivo'],['nearby','Red cercana, conexión sin confirmar'],['none','No se conoce red disponible']],{required:true}),
    {...source('electricity_source'),label:'¿En qué basás la respuesta sobre electricidad?'},
    text('electric_provider','Proveedor',{optional:true,when:when('electricity',['active','inactive','nearby'])}),
    group('Internet y señal celular'),
    select('internet','Internet fijo',[['installed','Instalado'],['confirmed','Proveedor confirma disponibilidad'],['none','No se conoce servicio']],{optional:true}),
    select('internet_technology','Tecnología',['Fibra','Cable','Internet inalámbrico fijo','Satelital'],{optional:true,when:when('internet',['installed','confirmed'])}),
    select('mobile','Cobertura celular',[['tested','Probada en el sitio'],['reported','Reportada, sin probar'],['none','No se detectó cobertura']],{optional:true}),
    select('mobile_operator','Operador probado',['Kölbi','Claro','Liberty','Varios'],{optional:true,when:when('mobile',['tested'])}),
    select('mobile_network','Red observada',['4G','5G','4G y 5G'],{optional:true,when:when('mobile',['tested'])}),
    group('Saneamiento y lluvia'),
    select('sewage','Aguas residuales',['Tanque séptico','Planta de tratamiento','Alcantarillado sanitario','No hay sistema instalado'],{optional:true}),
    select('rainwater','Drenaje observado',['Escurre por pendiente natural','Hay cunetas o drenajes','Se acumula en algunas zonas'],{optional:true}),
    note('services_notes','Limitaciones o detalles de los servicios')
  ]},
  {id:'buildings',short:'Construcciones',title:'Cada construcción, por separado.',lead:'Identificá lo que incluye la venta. Las medidas y los detalles pueden completarse después.',fields:[]},
  {id:'photos',short:'Fotos',title:'Prepará un recorrido claro.',lead:'Mostrá el terreno y cómo llegar. Elegí una portada entre tus fotos. No necesitás escribir pies de foto.',fields:[
    {...note('photo_exception','Si falta alguna toma, explicá por qué para que podamos revisarlo'),prominent:true}
  ]},
  {id:'documents',short:'Documentos',title:'El plano y lo que ya tengás.',lead:'Necesitamos el plano antes de publicar. Podés guardar un borrador mientras lo conseguís. Adjuntar un documento no significa que haya sido verificado.',fields:[
    group('Datos del plano'),
    text('plan','Número de plano',{optional:true,prominent:true,maxLength:40,help:'Podemos confirmar la transcripción al revisar el documento.'}),
    number('documented_area','Área que indica el plano (m²)',{optional:true,prominent:true,min:1}),
    group('Uso de suelo','La actividad actual y los usos permitidos se revisan por separado.'),
    select('landuse_status','¿Tenés certificado de uso de suelo?',[['available','Sí'],['requested','Está solicitado'],['none','No lo tengo']],{optional:true}),
    text('landuse_date','Fecha del uso de suelo',{type:'date',optional:true}),
    text('landuse_activity','Actividad a la que se refiere',{optional:true}),
    group('Impuestos municipales'),
    select('tax_status','Impuestos municipales',[['current','Al día, según información disponible'],['overdue','Con pendientes'],['unverified','No verificado']],{optional:true}),
    text('tax_date','Fecha de esa información',{type:'date',optional:true}),
    group('Asuntos para revisar'),
    note('documents_notes','Diferencias de área, documentos o asuntos pendientes')
  ]},
  {id:'sale',short:'Venta y contacto',title:'Los últimos datos de la venta.',lead:'Indicá el precio y cómo podemos contactarte. En el siguiente paso podés revisar la propuesta completa y enviarla.',fields:[
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
    select('role','Tu relación con la propiedad',[['owner','Propietario'],['representative','Representante autorizado']],{required:true,known:true})
  ]},
  {id:'review',short:'Resumen y envío',title:'Revisá tu propuesta antes de enviarla.',lead:'Revisá los datos y las fotos, confirmá las autorizaciones y enviá la ficha a ArenalIndex. El envío es privado; la publicación se realiza después de la revisión y aprobación.',fields:[
    group('Autorizaciones para enviar'),
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
export const stepIndex = id => steps.findIndex(step=>step.id===id);
export const activeSteps = draft => steps.map((_,i)=>i).filter(i=>steps[i].id!=='buildings'||hasBuildings(draft.values));
export const stepComplete = (draft,step,issues=pending(draft)) => steps[step].id==='review' ? issues.length===0 : !issues.some(issue=>issue.step===step);
export const activeGroups = values => [...photoGroups,...documentGroups].filter(g=>!g.building||hasBuildings(values));
export const validPoint = values => ['lat','lng'].every((key,i)=>typeof values[key]==='string'&&values[key].trim()!==''&&Number.isFinite(Number(values[key]))&&Math.abs(Number(values[key]))<=[90,180][i]);
export const label = (field,value) => field.type==='checkbox' ? (value?'Sí':'Pendiente') : field.options?.find(o=>o[0]===value)?.[1] || value || 'Pendiente';
export const reference = draft => draft.values.name?.trim() || 'Terreno · '+draft.id.slice(0,8).toUpperCase();
export const buildingName = (building,index) => building.id==='legacy-building'&&building.name==='Construcción de la ficha anterior'?'Construcción '+(index+1):building.name||'Construcción '+(index+1);
export const pricePerArea = values => Number(values.price)>0&&Number(values.documented_area)>0 ? Number(values.price)/Number(values.documented_area) : null;
export function areaDifference(values){
  const declared=Number(values.area),documented=Number(values.documented_area);
  return [declared,documented].every(n=>Number.isFinite(n)&&n>0)&&declared!==documented?{declared,documented}:null;
}
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
  if(d.buildings[0]?.id==='legacy-building'&&d.buildings[0].name==='Construcción de la ficha anterior')d.buildings[0].name='';
  const categories={overview:'land',flat:'land',entrance:'access',view:'surroundings',nature:'surroundings',aerial:'land',services:'technical',exterior:'buildings',living:'buildings',kitchen:'buildings',bedrooms:'buildings',bathrooms:'buildings',amenities:'buildings',interior:'buildings'};
  d.files=(input.files||[]).map(f=>({...f,category:categories[f.category]||f.category,shot:f.shot||(f.category==='entrance'?'entrance':f.category==='exterior'?'exterior':'general'),perspective:f.perspective||(f.category==='aerial'?'drone':'ground'),buildingId:f.buildingId||(['exterior','living','kitchen','bedrooms','bathrooms','amenities','interior'].includes(f.category)?d.buildings[0]?.id||'':'')}));
  d.step=Math.max(0,Math.min(steps.length-1,Number.isInteger(d.step)?d.step:0));
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
export function photoRequirements(draft) {
  const images=draft.files.filter(f=>f.type?.startsWith('image/'));
  const landCount=images.filter(f=>f.category==='land').length,accessCount=images.filter(f=>f.category==='access').length;
  const requirements=[
    {group:'land',label:'Dos fotos del terreno',complete:landCount>=2,detail:'Hay '+landCount+' de 2 fotos necesarias en «Terreno». Agregá las que faltan, con vistas distintas.'},
    {group:'access',label:'Una foto de la entrada',complete:images.some(f=>f.category==='access'&&f.shot==='entrance'),detail:accessCount?'Ya hay fotos en «Llegada y acceso», pero ninguna identificada como entrada. En la foto correspondiente, elegí «Entrada» en «Qué muestra».':'Agregá una foto en «Llegada y acceso» y elegí «Entrada» en «Qué muestra».'},
    {group:'access',label:'Una foto de la vía de llegada',complete:images.some(f=>f.category==='access'&&f.shot==='road'),detail:accessCount?'Ya hay fotos en «Llegada y acceso», pero ninguna identificada como vía de llegada. En la foto correspondiente, elegí «Vía de llegada» en «Qué muestra».':'Agregá una foto en «Llegada y acceso» y elegí «Vía de llegada» en «Qué muestra».'}
  ];
  if(hasBuildings(draft.values))for(const [index,b] of draft.buildings.entries())requirements.push({group:'buildings',label:'Foto exterior: '+buildingName(b,index),complete:images.some(f=>f.category==='buildings'&&f.buildingId===b.id&&f.shot==='exterior'),detail:'En «Construcciones», agregá o identificá una foto de «'+buildingName(b,index)+'» y elegí la toma «Exterior».'});
  const gallery=photoGroups.filter(g=>!g.building||hasBuildings(draft.values)).map(g=>g.id);
  requirements.push({group:'cover',label:'Elegir una foto de portada',complete:images.some(f=>f.id===draft.values.cover_id&&gallery.includes(f.category)),detail:'En la foto del recorrido que prefirás, pulsá «Usar de portada». Subir una foto no la selecciona automáticamente.'});
  return requirements;
}
export const photoIssues = draft => photoRequirements(draft).filter(item=>item.group!=='cover'&&!item.complete).map(item=>item.label);
export function pending(draft,{publication=false,review={}}={}) {
  const v=draft.values,issues=[];
  steps.forEach((s,step)=>s.fields.filter(f=>f.id&&visible(f,v)).forEach(f=>{if(fieldIssues(f,v[f.id]))issues.push({label:f.label,step,field:f.id});}));
  if(!validPoint(v)||v.exact!==true)issues.push({label:'Entrada exacta confirmada en el mapa',step:1});
  if(!v.phone?.trim()&&!v.email?.trim())issues.push({label:'Un teléfono o correo de contacto',step:stepIndex('sale'),field:'phone',detail:'Completá al menos uno de los dos medios de contacto: teléfono o correo.'});
  for(const [key,title] of [['authorization','Autorización de publicación'],['location_consent','Permiso para mostrar la entrada'],['photo_permission','Permiso de uso de fotografías']])if(v[key]!==true)issues.push({label:title,step:stepIndex('review')});
  if(!draft.files.some(f=>f.category==='plan_file'))issues.push({label:'Copia del plano catastrado',step:6,photoGroup:'plan_file',detail:'Adjuntá una copia legible del plano en el grupo «Plano catastrado».'});
  if(hasBuildings(v)) {
    if(!draft.buildings.length)issues.push({label:'Agregar las construcciones incluidas',step:4});
    for(const [index,b] of draft.buildings.entries()){if(!b.kind||b.kind==='unknown')issues.push({label:'Tipo de cada construcción',step:4});for(const f of buildingFields)if(fieldIssues(f,b[f.id]))issues.push({label:f.label+' · '+buildingName(b,index),step:4});}
  }
  for(const item of photoRequirements(draft))if(!item.complete&&(item.group==='cover'||!v.photo_exception?.trim()||(publication&&!review.photo_exception_accepted)))issues.push({label:item.label,step:5,photoGroup:item.group,detail:item.detail});
  if(publication) {
    if(!review.plan_number?.trim())issues.push({label:'Confirmar el número del plano',step:6});
    if(!(Number(review.documented_area)>0&&Number(review.documented_area)<1e9))issues.push({label:'Confirmar el área documentada',step:6});
    if(!review.plan_matches)issues.push({label:'Confirmar que el plano corresponde a la propiedad',step:6});
    if(Number(review.documented_area)!==Number(v.area)&&!review.discrepancy_resolved)issues.push({label:'Resolver la diferencia de área',step:6});
    if(!review.copy_checked)issues.push({label:'Revisar texto, fotos y condiciones conocidas',step:stepIndex('review')});
    if(v.buildings==='unknown')issues.push({label:'Confirmar si la venta incluye construcciones',step:0});
  }
  return issues;
}
export const inspectionItems = [
  {id:'erosion',label:'Erosión o taludes por revisar'},
  {id:'standing_water',label:'Acumulación de agua'},
  {id:'rain_access',label:'Dificultades de acceso en lluvia'},
  {id:'installations',label:'Daños o limitaciones en instalaciones'},
  {id:'boundaries',label:'Linderos o derecho de acceso por aclarar'},
  {id:'building_repairs',label:'Reparaciones en construcciones',building:true}
];
export const inspectionStates = [['','Sin revisar'],['not_reported','No se reporta'],['reported','Reportado por el vendedor'],['observed','Observado por ArenalIndex']];
export function normalizeReview(input={}) {
  const r=input&&typeof input==='object'?input:{};
  const trim=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
  const inspection={};
  for(const item of inspectionItems){
    const answer=r.inspection?.[item.id];
    if(answer&&inspectionStates.some(([id])=>id===answer.state))inspection[item.id]={state:answer.state,note:trim(answer.note,500)};
  }
  return {plan_number:trim(r.plan_number,40),documented_area:Number.isFinite(Number(r.documented_area))?Number(r.documented_area):0,plan_matches:r.plan_matches===true,
    discrepancy_resolved:r.discrepancy_resolved===true,photo_exception_accepted:r.photo_exception_accepted===true,
    copy_checked:r.copy_checked===true,inspection};
}
export function knownConcerns(draft,review={}) {
  const seller=[draft.values.land_notes,draft.values.water_notes,draft.values.services_notes,...(hasBuildings(draft.values)?draft.buildings.map(b=>b.notes):[])].filter(v=>typeof v==='string'&&v.trim());
  const findings=inspectionItems.filter(item=>!item.building||hasBuildings(draft.values)).flatMap(item=>{
    const finding=review.inspection?.[item.id];
    if(!['reported','observed'].includes(finding?.state))return [];
    return [item.label+' ('+(finding.state==='observed'?'observado por ArenalIndex':'reportado por el vendedor')+')'+(finding.note?': '+finding.note:'')];
  });
  return [...seller,...findings];
}
export function photoCaption(file,draft) {
  const group=[...photoGroups,...documentGroups].find(g=>g.id===file.category)?.title||'Archivo';
  const index=draft.buildings.findIndex(b=>b.id===file.buildingId),building=draft.buildings[index];
  const shot={entrance:'Entrada',road:'Vía de llegada',exterior:'Exterior',interior:'Interior'}[file.shot];
  return [group,building?buildingName(building,index):'',shot,file.type.startsWith('image/')?(file.perspective==='drone'?'Dron':'Desde el suelo'):''].filter(Boolean).join(' · ');
}
export function photoTour(draft) {
  const rank={road:0,entrance:1,exterior:0,interior:1,general:2};
  const ordered=files=>files.map((file,index)=>({file,index})).sort((a,b)=>(rank[a.file.shot]??2)-(rank[b.file.shot]??2)||Number(a.file.perspective==='drone')-Number(b.file.perspective==='drone')||a.index-b.index).map(row=>row.file);
  return photoGroups.filter(g=>!g.building||hasBuildings(draft.values)).flatMap(group=>{
    const images=draft.files.filter(f=>f.category===group.id&&f.type.startsWith('image/'));
    if(!group.building)return images.length?[{id:group.id,title:group.title,files:ordered(images)}]:[];
    return [...draft.buildings.map((building,index)=>({id:group.id+'-'+building.id,title:group.title+' · '+buildingName(building,index),files:ordered(images.filter(f=>f.buildingId===building.id))})),
      {id:'buildings-unassigned',title:'Construcciones · por asignar',files:ordered(images.filter(f=>!draft.buildings.some(b=>b.id===f.buildingId)))}].filter(section=>section.files.length);
  });
}
export function buyerCopy(draft,review={}) {
  const v=draft.values,number=value=>Number.isFinite(Number(value))&&Number(value)>0?Number(value):null;
  const format=value=>new Intl.NumberFormat('es-CR',{maximumFractionDigits:0}).format(Number(value));
  const field=id=>steps.flatMap(s=>s.fields).find(f=>f.id===id);
  const known=id=>typeof v[id]==='string'&&v[id]!==''&&v[id]!=='unknown';
  const answer=id=>label(field(id),v[id]);
  const source=id=>v[id+'_source']==='observed'?'observación indicada por el vendedor':v[id+'_source']==='document'?'documentación indicada por el vendedor':'información del vendedor';
  const documented=number(review.documented_area)||number(v.documented_area),area=documented||number(v.area);
  const parts=[];
  if(v.listing_title?.trim())parts.push(v.listing_title.trim());
  parts.push((area?'Terreno de '+format(area)+' m²':'Terreno con área por confirmar')+(hasBuildings(v)?' con '+draft.buildings.length+' construcción(es).':v.buildings==='no'?' sin construcciones.':'. Construcciones por confirmar.'));
  if(area)parts.push(documented?'Área indicada del plano'+(review.plan_matches?' revisado.':' (pendiente de revisión).'):'Área declarada por el vendedor.');
  if(known('current_use'))parts.push('Uso actual: '+answer('current_use')+' (información del vendedor). Los usos permitidos se revisan por separado.');
  parts.push('Topografía: '+(known('terrain')?answer('terrain').toLowerCase()+' (información del vendedor).':'por confirmar.'));
  if(number(v.usable))parts.push('Área relativamente plana reportada: '+format(v.usable)+' m². No equivale a superficie edificable autorizada.');
  const road=known('road')?answer('road').toLowerCase():'superficie por confirmar';
  parts.push('Llegada: '+road+(v.access==='private'?', seguida de acceso privado'+(known('private_surface')?' de '+answer('private_surface').toLowerCase():' con superficie por confirmar'):v.access==='direct'?', con entrada directa':'; tipo de acceso por confirmar')+' (información del vendedor).');
  if(v.access==='private'&&number(v.private_length))parts.push('Tramo privado indicado: '+format(v.private_length)+' m.');
  if(v.access==='private')parts.push(v.legal_access==='supplied'?'Derecho de acceso: el vendedor indica que tiene un documento para revisar.':'Derecho de acceso: no verificado.');
  if(v.driveway==='yes')parts.push('Camino interno'+(known('driveway_surface')?' de '+answer('driveway_surface').toLowerCase():'')+' reportado por el vendedor.');
  parts.push('Agua: '+(known('water')?answer('water').toLowerCase()+' ('+source('water')+').':'por confirmar.'));
  if(known('water_provider')&&['active','inactive','documented','nearby'].includes(v.water))parts.push('Proveedor de agua indicado: '+v.water_provider+'.');
  if(v.water==='documented')parts.push('Carta de disponibilidad'+(v.water_date?' con fecha indicada '+v.water_date:' sin fecha indicada')+'. Vigencia y alcance por confirmar con el emisor.');
  if(v.well==='yes')parts.push('Se reporta un pozo. Potabilidad y derechos de uso por confirmar.');
  if(known('waterbody')&&v.waterbody!=='No se reporta')parts.push('Río, quebrada o naciente: '+answer('waterbody').toLowerCase()+' (información del vendedor). Su presencia no confirma derechos de aprovechamiento.');
  if(v.water_rights==='document')parts.push('El vendedor indica que dispone de respaldo sobre el uso de agua; pendiente de revisión.');
  parts.push('Electricidad: '+(known('electricity')?answer('electricity').toLowerCase()+' ('+source('electricity')+').':'por confirmar.'));
  if(known('electric_provider')&&['active','inactive','nearby'].includes(v.electricity))parts.push('Proveedor eléctrico indicado: '+v.electric_provider+'.');
  if(known('internet'))parts.push('Internet fijo: '+answer('internet').toLowerCase()+(['installed','confirmed'].includes(v.internet)&&known('internet_technology')?' · '+answer('internet_technology'):'')+' (información del vendedor).');
  if(known('mobile'))parts.push('Cobertura celular: '+answer('mobile').toLowerCase()+(v.mobile==='tested'?[v.mobile_operator,v.mobile_network].filter(x=>x&&x!=='unknown').map(x=>' · '+x).join(''):'')+' (información del vendedor).');
  for(const [id,title] of [['sewage','Aguas residuales'],['rainwater','Drenaje'],['volcano','Vista al volcán desde el suelo']])if(known(id))parts.push(title+': '+answer(id)+' (información del vendedor).');
  if(known('residential')&&v.residential!=='no')parts.push(answer('residential')+(v.fees?' · cuota indicada: '+v.fees:'')+' (información del vendedor; régimen pendiente de revisión).');
  if(hasBuildings(v))for(const [index,b] of draft.buildings.entries()){
    const details=[buildingName(b,index),label(buildingFields.find(f=>f.id==='kind'),b.kind)];
    if(number(b.area))details.push(format(b.area)+' m²'+(b.area_source&&b.area_source!=='unknown'?' · '+b.area_source:' · medida reportada'));
    for(const [key,title] of [['bedrooms','habitaciones'],['bathrooms','baños']])if(b[key]!==undefined&&b[key]!==''&&Number.isFinite(Number(b[key])))details.push(b[key]+' '+title);
    if(b.condition&&b.condition!=='unknown')details.push(b.condition);
    parts.push(details.join(' · ')+' (información del vendedor).');
  }
  if(v.landuse_status==='available'||draft.files.some(f=>f.category==='landuse_file'))parts.push('Uso de suelo: certificado '+(draft.files.some(f=>f.category==='landuse_file')?'aportado':'reportado por el vendedor')+(v.landuse_date?' · fecha indicada '+v.landuse_date:'')+(v.landuse_activity?' · actividad consultada: '+v.landuse_activity:'')+'. Alcance pendiente de revisión; no acredita permiso para cualquier uso.');
  if(known('tax_status'))parts.push('Impuestos municipales: '+answer('tax_status')+(v.tax_date?' · información de '+v.tax_date:' · sin fecha indicada')+'.');
  const currency=['USD','CRC'].includes(v.currency)?v.currency:null,price=number(v.price);
  if(currency&&price){const money=(amount,digits=0)=>new Intl.NumberFormat('es-CR',{style:'currency',currency,maximumFractionDigits:digits}).format(amount);parts.push('Precio solicitado: '+money(price)+'.');if(documented)parts.push('Precio por m² de terreno: '+money(price/documented,2)+' (sobre el área indicada del plano).');}
  if(known('negotiable'))parts.push('Precio negociable: '+answer('negotiable')+'.');
  if(known('financing'))parts.push('Financiamiento del vendedor: '+answer('financing')+'.');
  if(v.terms?.trim())parts.push('Condiciones de venta indicadas: '+v.terms.trim());
  const concerns=knownConcerns(draft,review);if(concerns.length)parts.push('Condiciones para tener en cuenta:\n'+concerns.map(note=>'• '+note).join('\n'));
  return parts.join('\n\n');
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
