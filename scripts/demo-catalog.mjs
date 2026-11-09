import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {newDraft,validateDraft,pending,photoRequirements} from '../site/newlisting/model.mjs';
import {createPublication} from '../server/intake/publication.mjs';

const building=(id,kind,name,area,bedrooms,bathrooms,condition='Bueno')=>({id,kind,name,area:String(area),area_source:'Estimación del propietario',bedrooms:String(bedrooms),bathrooms:String(bathrooms),condition});
const profiles=[
 {title:'Casa y cabaña entre jardines',use:'Vivienda',terrain:'Mixto',road:'Lastre',access:'private',water:'active',electricity:'active',residential:'no',volcano:'Parcial',price:215000,cover:'house',buildings:[building('house','house','Casa principal',120,3,2),building('cabin','cabin','Cabaña del jardín',36,1,1)],description:'Dos espacios independientes entre jardines y terreno abierto. La llegada incluye un tramo privado de lastre; la casa y la cabaña se describen por separado.'},
 {title:'Lote en condominio con áreas comunes',use:'Sin uso',terrain:'Mayormente plano',road:'Asfalto / concreto',access:'direct',water:'documented',electricity:'nearby',residential:'condo',volcano:'No tiene',price:65000,cover:'land',buildings:[],description:'Un lote sin construcciones dentro de un condominio. Incluye un ejemplo de cuota mensual y servicios con disponibilidad indicada, todavía sin conexión activa.'},
 {title:'Terreno en ladera con vista al Arenal',use:'Recreación / descanso',terrain:'Mayormente inclinado',road:'Tierra',access:'private',water:'nearby',electricity:'nearby',residential:'no',volcano:'Completa',price:48000,cover:'view',buildings:[],description:'Una ladera abierta hacia el paisaje, con acceso por camino de tierra. El área relativamente plana es una observación y no representa superficie edificable autorizada.',concern:'En época lluviosa puede ser necesario un vehículo alto.'},
 {title:'Dos cabañas en un jardín tropical',use:'Alojamiento turístico',terrain:'Mixto',road:'Lastre',access:'direct',water:'active',electricity:'active',residential:'no',volcano:'Parcial',price:185000,cover:'house',buildings:[building('cabin-a','cabin','Cabaña del mango',48,1,1),building('cabin-b','cabin','Cabaña del jardín',56,2,1)],description:'Dos cabañas independientes en un jardín amplio. El ejemplo distingue el alojamiento actual de los usos que autorice la municipalidad.'},
 {title:'Parcela agrícola con bodega',use:'Cultivos o ganadería',terrain:'Mixto',road:'Lastre',access:'direct',water:'none',electricity:'active',residential:'no',volcano:'No tiene',price:125000,cover:'land',scale:4,well:'yes',buildings:[building('storage','storage','Bodega de herramientas',72,0,0,'Necesita mantenimiento')],description:'Una parcela de mayor extensión con una bodega para herramientas. Se reporta un pozo; la potabilidad y los derechos de uso quedan por confirmar.',concern:'La cubierta de la bodega requiere mantenimiento.'},
 {title:'Terreno plano en residencial',use:'Sin uso',terrain:'Mayormente plano',road:'Asfalto / concreto',access:'direct',water:'active',electricity:'active',residential:'residential',volcano:'No tiene',price:79000,cover:'land',buildings:[],description:'Un terreno sin construcciones en un residencial con vías públicas. El ejemplo incluye agua conectada, medidor eléctrico activo y disponibilidad de internet.'},
 {title:'Terreno junto a una quebrada',use:'Recreación / descanso',terrain:'Mixto',road:'Lastre',access:'private',water:'unknown',electricity:'nearby',residential:'no',volcano:'No tiene',waterbody:'Colindante',price:95000,cover:'land',buildings:[],description:'Un terreno con vegetación y una quebrada colindante. Se mantienen por confirmar el agua de red y las condiciones aplicables a la franja cercana al cauce.',concern:'La franja de protección del cauce debe revisarse antes de proyectar obras.'},
 {title:'Local con terreno y entrada directa',use:'Comercio',terrain:'Mayormente plano',road:'Asfalto / concreto',access:'direct',water:'active',electricity:'active',residential:'no',volcano:'No tiene',price:165000,cover:'land',buildings:[building('commercial','commercial','Local principal',90,0,1)],description:'Un local con acceso directo desde la vía y espacio abierto. Se describe el uso comercial actual sin dar por autorizadas otras actividades.'},
 {title:'Lote abierto para un nuevo proyecto',use:'Sin uso',terrain:'Mayormente plano',road:'Lastre',access:'direct',water:'documented',electricity:'nearby',residential:'no',volcano:'Parcial',price:55000,cover:'land',buildings:[],description:'Un lote sin construcciones con una zona abierta y vista parcial. Hay una carta de disponibilidad de agua en el ejemplo; la instalación del servicio eléctrico sigue pendiente.'},
 {title:'Casa con patio para renovar',use:'Vivienda',terrain:'Mayormente plano',road:'Mixto',access:'direct',water:'active',electricity:'inactive',residential:'residential',volcano:'No tiene',price:110000,cover:'house',buildings:[building('house','house','Casa principal',105,2,1,'Necesita reparaciones importantes')],description:'Una casa con patio y espacios por renovar. El ejemplo señala reparaciones pendientes y un medidor eléctrico inactivo para que esas condiciones sean visibles.',concern:'Hay reparaciones pendientes en techo e instalaciones; conviene revisar su alcance.'}
];
const paths={land:'photos/tropical-plot.jpg',landOther:'photos/lot.jpg',house:'photos/house.jpg',view:'photos/garden-volcano.jpg'};
export function demoDraft(seed,index){
 const profile=profiles[index%profiles.length],variation=Math.floor(index/profiles.length);
 const d=newDraft('demo-refresh-'+seed.id),area=Math.round(seed.area*(profile.scale||1));
 const currency=(index*37%10)<4?'CRC':'USD',dollars=profile.price+variation*5500;
 d.values={buildings:profile.buildings.length?'yes':'no',listing_title:profile.title,current_use:profile.use,
  lat:String(seed.lat),lng:String(seed.lng),exact:true,location_method:'map',area:String(area),terrain:profile.terrain,
  inspected:variation%3?'yes':'no',usable:String(Math.round(area*(profile.terrain==='Mayormente plano'?.85:profile.terrain==='Mixto'?.55:.25))),
  road:profile.road,access:profile.access,volcano:profile.volcano,waterbody:profile.waterbody||'No se reporta',residential:profile.residential,
  driveway:profile.buildings.length?'yes':'no',water:profile.water,water_source:profile.water==='documented'?'document':'seller',
  electricity:profile.electricity,electricity_source:'seller',well:profile.well||'no',water_rights:profile.well?'unverified':'not_applicable',
  internet:profile.electricity==='active'?(profile.buildings.length?'installed':'confirmed'):'unknown',
  mobile:variation%2?'tested':'reported',sewage:profile.buildings.length?'Tanque séptico':'unknown',rainwater:variation%2?'Hay cunetas o drenajes':'unknown',
  landuse_status:variation%2?'requested':'unknown',tax_status:'unverified',
  price:String(currency==='CRC'?Math.round(dollars*450/1000000)*1000000:dollars),currency,
  negotiable:variation%3?'Sí':'Consultar',financing:variation%4?'No':'Consultar',
  terms:profile.buildings.length?'Incluye las construcciones descritas. Mobiliario por acordar.':'Venta del terreno, sin construcciones.',
  contact:'Propietario de ejemplo',email:'demo@example.invalid',role:'owner',authorization:true,location_consent:true,photo_permission:true,
  cover_id:profile.cover==='house'?'building-'+profile.buildings[0].id:profile.cover==='view'?'view-1':'land-1'};
 if(profile.access==='private')Object.assign(d.values,{private_length:String(80+variation*20),private_surface:profile.road,legal_access:'unverified'});
 if(profile.buildings.length)d.values.driveway_surface='Lastre';
 if(['active','documented','nearby','inactive'].includes(profile.water))d.values.water_provider='ASADA de ejemplo';
 if(profile.water==='documented')d.values.water_date='2026-11-01';
 if(profile.electricity!=='none')d.values.electric_provider='Proveedor por confirmar';
 if(['installed','confirmed'].includes(d.values.internet))d.values.internet_technology=variation%2?'Fibra':'Internet inalámbrico fijo';
 if(d.values.mobile==='tested')Object.assign(d.values,{mobile_operator:'Kölbi',mobile_network:'4G'});
 if(profile.residential==='condo')d.values.fees='₡45,000 mensuales · ejemplo';
 if(profile.residential==='residential')d.values.fees='Sin cuota reportada · ejemplo';
 if(profile.concern)d.values.land_notes=profile.concern;
 d.buildings=profile.buildings.map(b=>({...b,area:String(Number(b.area)+variation*2)}));
 const photo=(id,category,shot='general',buildingId='')=>({id,category,shot,buildingId,name:id+'.jpg',type:'image/jpeg',size:1000,perspective:'ground'});
 d.files=[photo('land-1','land'),photo('land-2','land'),photo('entry-1','access','entrance'),photo('road-1','access','road'),photo('view-1','surroundings'),
  ...d.buildings.map(b=>photo('building-'+b.id,'buildings','exterior',b.id)),
  {id:'plan-1',name:'plano-de-ejemplo.pdf',category:'plan_file',type:'application/pdf',size:1000}];
 return {draft:validateDraft(d),profile};
}
export function demoListing(seed,index){
 const {draft,profile}=demoDraft(seed,index),area=Number(draft.values.area);
 const review={plan_number:'DEMO-SIN-VALIDEZ',documented_area:area,plan_matches:true,copy_checked:true};
 const issues=pending(draft,{publication:true,review});
 if(issues.length||photoRequirements(draft).some(r=>!r.complete))throw Error(seed.id+': '+issues.map(i=>i.label).join(', '));
 const {listing}=createPublication({id:draft.id,payload:draft,version:1,status:'approved',review},
  {title:profile.title,place:seed.place,description:profile.description,whatsapp:''},
  {apiURL:'https://example.invalid/demo',date:'2026-11-09T00:00:00Z'});
 const photoPath=id=>id==='land-1'?paths.land:id==='land-2'?paths.landOther:id==='view-1'?paths.view:id.startsWith('building-')?paths.house:paths.landOther;
 for(const group of listing.details.photoGroups){
  group.title+=' · ilustraciones';
  for(const p of group.photos){p.src=photoPath(p.id);p.caption='Imagen ilustrativa · '+p.caption;}
 }
 const gallery=listing.details.photoGroups.flatMap(g=>g.photos);
 listing.images=[photoPath(draft.values.cover_id),...new Set(gallery.map(p=>p.src))].filter((src,i,all)=>all.indexOf(src)===i);
 // The examples follow the form, but never claim that a real property or document was reviewed.
 for(const section of listing.details.sections)for(const row of section.rows)row.source='Dato ficticio de demostración';
 for(const b of listing.details.buildings)for(const row of b.rows)row.source='Dato ficticio de demostración';
 listing.details.areaSource='Área de ejemplo';listing.details.entrance=false;
 delete listing.details.reviewedAt;delete listing.details.publishedAt;
 return {...listing,id:seed.id,is_demo:true,approximate:true,status:seed.status,sort_order:(index*37)%100+1};
}
export function refreshCatalog(seed){return seed.map(demoListing);}
export function migration(rows){
 const fields=['name','description','place','price','area','house','volcano','river','water','electricity','well','private_residential','approximate','images','sort_order','currency','details'];
 const json=JSON.stringify(rows);
 return `-- Refresh existing demo listings only. Existing IDs, positions and publication status are preserved.\n-- Generated by scripts/demo-catalog.mjs; photos and facts are explicitly fictitious.\nbegin;\nalter table public.arenalindex_properties add column if not exists currency text not null default 'USD' check (currency in ('USD','CRC'));\nalter table public.arenalindex_properties add column if not exists details jsonb;\nwith updates as (select * from jsonb_populate_recordset(null::public.arenalindex_properties, $demo$${json}$demo$::jsonb)),\nchanged as (\n update public.arenalindex_properties p set ${fields.map(k=>k+'=u.'+k).join(',')}\n from updates u where p.id=u.id and p.is_demo is true\n returning p.id,p.currency,p.house,p.details\n)\nselect count(*) as updated_demos,count(*) filter(where currency='CRC') as crc_demos,count(*) filter(where house) as with_buildings,count(*) filter(where details->>'residential'='condo') as condos from changed;\ncommit;\n`;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const seed=JSON.parse(await readFile(new URL('../supabase/demo-properties.json',import.meta.url),'utf8'));
 const rows=refreshCatalog(seed);
 await writeFile(new URL('../supabase/demo-properties-v2.json',import.meta.url),JSON.stringify(rows,null,2)+'\n');
 await writeFile(new URL('../supabase/migrations/202611090001_demo_refresh.sql',import.meta.url),migration(rows));
 console.log(JSON.stringify({count:rows.length,crc:rows.filter(r=>r.currency==='CRC').length,buildings:rows.filter(r=>r.house).length,condo:rows.filter(r=>r.details.residential==='condo').length}));
}
