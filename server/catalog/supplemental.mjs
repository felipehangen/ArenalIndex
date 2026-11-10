// Fictional showcase, not a real offer. Image provenance: docs/demo-photo-credits.md.
const fact=(label,value)=>({label,value,source:'Dato ficticio de demostración'});
const photo=(id,label)=>({id,src:'/photos/demo-tropical-'+id+'.webp',caption:'Imagen ilustrativa · '+label+' · Orphic Clicks / Pexels',perspective:'ground'});
const description='Demo ficticio de una casa entre jardines tropicales. Las fotos son de referencia: no corresponden a una propiedad en venta. El precio, las medidas y la ubicación son ejemplos.';

export const supplementalDemos=[{
  id:'lot-101',name:'Casa entre jardines tropicales · demo',description,
  place:'La Fortuna',price:295000,currency:'USD',area:2400,
  lat:10.463,lng:-84.628,house:true,volcano:false,river:false,
  water:true,electricity:true,well:false,private_residential:false,
  approximate:true,is_demo:true,
  images:['garden','exterior','terrace','pool'].map(id=>'/photos/demo-tropical-'+id+'.webp'),
  details:{
    schemaVersion:1,language:'es',titlesReviewed:true,
    translations:{
      es:{title:'Casa entre jardines tropicales · demo',description},
      en:{title:'Tropical garden home · demo',description:'A fictional demo of a home among tropical gardens. These are reference photos, not a property offered for sale. The price, measurements and location are examples.'}
    },
    declaredArea:2400,documentedArea:2400,areaSource:'Área de ejemplo',entrance:false,residential:'no',
    contact:{name:'Felipe',whatsapp:'50688542664',phone:'50688542664',email:'felipehangen@gmail.com'},
    sections:[
      {id:'land',title:'El terreno',rows:[fact('Uso actual','Vivienda'),fact('Topografía','Mayormente plano'),fact('Vista al volcán desde el suelo','No tiene'),fact('Río, quebrada o naciente','No se reporta')]},
      {id:'access',title:'Llegada y acceso',rows:[fact('Vía de llegada','Lastre'),fact('Hasta la entrada','La entrada da directamente a la vía'),fact('Camino dentro de la propiedad','Sí')]},
      {id:'services',title:'Servicios e infraestructura',rows:[fact('Agua de red','Conexión activa'),fact('Electricidad','Medidor activo'),fact('Internet fijo','Instalado'),fact('Tecnología de internet','Fibra'),fact('Aguas residuales','Tanque séptico')]},
      {id:'community',title:'Residencial o condominio',rows:[fact('Tipo de desarrollo','No')]},
      {id:'documents',title:'Información documental',rows:[fact('Área del plano','2,400 m²'),fact('Certificado de uso de suelo','No confirmado'),fact('Impuestos municipales','No verificado')]},
      {id:'sale',title:'Condiciones de venta',rows:[fact('Precio negociable','Consultar'),fact('Financiamiento del vendedor','No')]}
    ],
    buildings:[{id:'house',name:'Casa principal',rows:[fact('Tipo de construcción','Casa'),fact('Área construida (m²)','210 m²'),fact('Fuente de esa medida','Estimación del propietario'),fact('Habitaciones','3'),fact('Baños','2'),fact('Estado observado','Bueno')]}],
    photoGroups:[
      {id:'garden',title:'Jardín · imágenes de referencia',photos:[photo('garden','Jardín')]},
      {id:'buildings-house',title:'Casa principal · imágenes de referencia',photos:[photo('exterior','Exterior'),photo('terrace','Terraza')]},
      {id:'pool',title:'Piscina · imágenes de referencia',photos:[photo('pool','Piscina')]}
    ],
    conditions:['Anuncio ficticio de demostración. No es una oferta de venta.']
  }
}];
