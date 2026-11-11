// Curated stock-photo demos. Sources and image processing are documented in
// docs/demo-photos-2026-11-10.json; none of these are real property offers.
const fact=(label,value)=>({label,value,source:'Dato ficticio de demostración'});
export const photo=(name,label,author,perspective='ground')=>({id:name,src:'/photos/demo-'+name+'.webp',caption:'Imagen ilustrativa · '+label+' · '+author+' / Pexels',perspective});
export const building=(id,name,kind,area,bedrooms,bathrooms)=>({id,name,rows:[fact('Tipo de construcción',kind),fact('Área construida (m²)',area+' m²'),fact('Fuente de esa medida','Estimación del propietario'),fact('Habitaciones',String(bedrooms)),fact('Baños',String(bathrooms)),fact('Estado observado','Bueno')]});
const disclosure={es:'Ejemplo ficticio; fotos de referencia, precio, medidas y ubicación ilustrativos. No es una oferta de venta.',en:'Fictional example with reference photos, illustrative pricing, measurements and location. Not an offer for sale.'};
export function showcase({id,es,en,place,price,currency='USD',area,lat,lng,terrain='Mixto',volcano=false,river=false,water='No confirmado',electricity='No confirmado',well=false,residential='no',road='Lastre',use,buildings=[],groups}){
  const house=buildings.length>0;
  const development={no:'No',residential:'Residencial con vías públicas',condo:'Condominio con áreas comunes privadas'}[residential];
  return {id,name:es,description:disclosure.es,place,price,currency,area,lat,lng,house,volcano,river,
    water:['Conexión activa','Carta de disponibilidad'].includes(water),electricity:electricity==='Medidor activo',well,private_residential:residential==='condo',approximate:true,is_demo:true,
    images:groups.flatMap(group=>group.photos.map(p=>p.src)),
    details:{schemaVersion:1,language:'es',titlesReviewed:true,translations:{es:{title:es,description:disclosure.es},en:{title:en,description:disclosure.en}},
      declaredArea:area,documentedArea:area,areaSource:'Área de ejemplo',entrance:false,residential,
      contact:{name:'Felipe',whatsapp:'50688542664',phone:'50688542664',email:'equipo@arenalindex.com'},
      sections:[
        {id:'land',title:'El terreno',rows:[fact('Uso actual',use||(house?'Vivienda':'Recreación / descanso')),fact('Topografía',terrain),fact('Vista al volcán desde el suelo',volcano?'Parcial':'No tiene'),fact('Río, quebrada o naciente',river?'Colindante':'No se reporta')]},
        {id:'access',title:'Llegada y acceso',rows:[fact('Vía de llegada',road),fact('Hasta la entrada','La entrada da directamente a la vía'),fact('Camino dentro de la propiedad',house?'Sí':'No')]},
        {id:'services',title:'Servicios e infraestructura',rows:[fact('Agua de red',water),fact('Electricidad',electricity),fact('Internet fijo',house?'Instalado':'No confirmado'),fact('Aguas residuales',house?'Tanque séptico':'No confirmado'),...(well?[fact('Pozo','Sí')]:[])]},
        {id:'community',title:'Residencial o condominio',rows:[fact('Tipo de desarrollo',development)]},
        {id:'documents',title:'Información documental',rows:[fact('Área del plano',area.toLocaleString('en-US')+' m²'),fact('Certificado de uso de suelo','No confirmado'),fact('Impuestos municipales','No verificado')]},
        {id:'sale',title:'Condiciones de venta',rows:[fact('Precio negociable','Consultar'),fact('Financiamiento del vendedor','No')]}
      ],buildings,photoGroups:groups,conditions:['Anuncio ficticio de demostración. No es una oferta de venta.']
    }
  };
}
export const group=(id,title,photos)=>({id,title:title+' · imágenes de referencia',photos});
export const newShowcases=[
  showcase({id:'lot-102',es:'Casa con terraza y piscina · demo',en:'Home with terrace and pool · demo',place:'La Fortuna',price:495000,area:1800,lat:10.475,lng:-84.634,terrain:'Mayormente plano',water:'Conexión activa',electricity:'Medidor activo',
    buildings:[building('house','Casa principal','Casa',275,3,3)],groups:[group('buildings-house','Casa principal',[
      photo('villa-front','Exterior','Keegan Checks'),photo('villa-wide','Vista general','Keegan Checks'),photo('villa-terrace','Terraza','Keegan Checks')])]}),
  showcase({id:'lot-103',es:'Cabañas en el bosque · demo',en:'Forest cabins · demo',place:'El Castillo',price:128000000,currency:'CRC',area:5200,lat:10.414,lng:-84.746,water:'Conexión activa',electricity:'Medidor activo',
    buildings:[building('cabin-a','Cabaña principal','Cabaña',90,2,2),building('cabin-b','Cabaña del jardín','Cabaña',65,2,1)],groups:[
      group('buildings','Construcciones',[photo('forest-cabins','Exterior','Dante Muñoz'),photo('forest-exterior','Vista general','Dante Muñoz')]),
      group('surroundings','Entorno y vistas',[photo('forest-pool','Piscina','Dante Muñoz'),photo('forest-canopy','Bosque','Dante Muñoz')])]}),
  showcase({id:'lot-104',es:'Terreno con vista al Arenal · demo',en:'Land with Arenal views · demo',place:'El Tanque',price:95000,area:3400,lat:10.484,lng:-84.598,volcano:true,water:'Carta de disponibilidad',electricity:'No confirmado',groups:[
    group('surroundings','Entorno y vistas',[photo('volcano-sunset','Vista al volcán','Jean Paul Montanaro','drone'),photo('volcano-valley','Entorno y vistas','Jean Paul Montanaro','drone'),photo('volcano-garden','Jardín','Justine BECKER')])]}),
  showcase({id:'lot-105',es:'Colina con vista al lago · demo',en:'Hillside overlooking the lake · demo',place:'El Castillo',price:132000,area:7800,lat:10.439,lng:-84.771,terrain:'Mayormente inclinado',groups:[
    group('surroundings','Entorno y vistas',[photo('lake-hills','Vista al lago','Brian Parra Artavia','drone'),photo('lake-shore','Vista al lago','Andrés Góngora'),photo('lake-volcano','Vista al volcán','Brian Parra Artavia','drone')])]}),
  showcase({id:'lot-106',es:'Bosque junto al río · demo',en:'Forest beside the river · demo',place:'Chachagua',price:65000000,currency:'CRC',area:12000,lat:10.401,lng:-84.594,river:true,groups:[
    group('surroundings','Entorno y vistas',[photo('river-bank','Río','Koen Swiers'),photo('river-trees','Bosque','Laura Hilkovic'),photo('river-rocks','Río','Mariam')])]})
];
