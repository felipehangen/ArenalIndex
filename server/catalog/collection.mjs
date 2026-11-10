// Twenty-five fictional, managed demos. Licensed sources and processing:
// docs/demo-collection-photos-2026-11-10.json. Galleries are illustrative references.
import {showcase,building,photo,group} from './showcases.mjs';
const references={
  "834958": {
    "label": "Vista al volcán",
    "author": "Diego Madrigal",
    "perspective": "ground"
  },
  "923228": {
    "label": "Vista al volcán",
    "author": "Jordan Corrales",
    "perspective": "ground"
  },
  "3209035": {
    "label": "Habitación",
    "author": "Jason Boyd",
    "perspective": "ground"
  },
  "4146874": {
    "label": "Terraza",
    "author": "Vincent Rivaud",
    "perspective": "ground"
  },
  "4807058": {
    "label": "Vista al volcán",
    "author": "Dominik Simecek",
    "perspective": "ground"
  },
  "4917176": {
    "label": "Interior",
    "author": "Maria Orlova",
    "perspective": "ground"
  },
  "5652566": {
    "label": "Bosque",
    "author": "Nur Andi Ravsanjani Gusma",
    "perspective": "ground"
  },
  "5769602": {
    "label": "Jardín",
    "author": "Julia Volk",
    "perspective": "ground"
  },
  "5819273": {
    "label": "Vista al lago",
    "author": "Lachcim Kejarko",
    "perspective": "ground"
  },
  "5819320": {
    "label": "Vista al lago",
    "author": "Lachcim Kejarko",
    "perspective": "ground"
  },
  "6063234": {
    "label": "Exterior",
    "author": "FOX ^.ᆽ.^= ∫",
    "perspective": "ground"
  },
  "6198925": {
    "label": "Río",
    "author": "Mario Rojas",
    "perspective": "ground"
  },
  "7873251": {
    "label": "Interior",
    "author": "Kübra Arslaner",
    "perspective": "ground"
  },
  "8089261": {
    "label": "Interior",
    "author": "Max Vakhtbovych",
    "perspective": "ground"
  },
  "8112338": {
    "label": "Interior",
    "author": "Rachel Claire",
    "perspective": "ground"
  },
  "8407009": {
    "label": "Jardín",
    "author": "Tara Winstead",
    "perspective": "ground"
  },
  "9730025": {
    "label": "Exterior",
    "author": "Keegan Checks",
    "perspective": "ground"
  },
  "9890614": {
    "label": "Jardín",
    "author": "Magda Ehlers",
    "perspective": "ground"
  },
  "10023263": {
    "label": "Cultivos",
    "author": "Luis Alberto Arias",
    "perspective": "drone"
  },
  "10023264": {
    "label": "Entorno y vistas",
    "author": "Luis Alberto Arias",
    "perspective": "drone"
  },
  "10999543": {
    "label": "Potrero",
    "author": "Carlos Suárez",
    "perspective": "ground"
  },
  "10999580": {
    "label": "Potrero",
    "author": "Carlos Suárez",
    "perspective": "ground"
  },
  "12715506": {
    "label": "Interior",
    "author": "Keegan Checks",
    "perspective": "ground"
  },
  "12800406": {
    "label": "Río",
    "author": "Koen Swiers",
    "perspective": "ground"
  },
  "13068962": {
    "label": "Vista al volcán",
    "author": "Andrés Góngora",
    "perspective": "ground"
  },
  "13914268": {
    "label": "Vista general",
    "author": "Thibault Om",
    "perspective": "ground"
  },
  "13914273": {
    "label": "Exterior",
    "author": "Thibault Om",
    "perspective": "ground"
  },
  "13914276": {
    "label": "Terraza",
    "author": "Thibault Om",
    "perspective": "ground"
  },
  "13914283": {
    "label": "Piscina",
    "author": "Thibault Om",
    "perspective": "ground"
  },
  "14025909": {
    "label": "Habitación",
    "author": "Quang Nguyen Vinh",
    "perspective": "ground"
  },
  "14510506": {
    "label": "Entorno y vistas",
    "author": "Jean Paul Montanaro",
    "perspective": "drone"
  },
  "14817856": {
    "label": "Exterior",
    "author": "Thượng Hy",
    "perspective": "ground"
  },
  "16262294": {
    "label": "Interior",
    "author": "Sarah O'Shea",
    "perspective": "ground"
  },
  "16436925": {
    "label": "Habitación",
    "author": "Luis Zambrano",
    "perspective": "ground"
  },
  "16863800": {
    "label": "Cascada",
    "author": "Edgar Arroyo",
    "perspective": "drone"
  },
  "16918564": {
    "label": "Jardín",
    "author": "Ronnie D",
    "perspective": "ground"
  },
  "16918575": {
    "label": "Exterior",
    "author": "Ronnie D",
    "perspective": "ground"
  },
  "17302316": {
    "label": "Atardecer",
    "author": "Jean-Daniel Francoeur",
    "perspective": "drone"
  },
  "17302380": {
    "label": "Vía de llegada",
    "author": "Jean-Daniel Francoeur",
    "perspective": "ground"
  },
  "17302407": {
    "label": "Bosque",
    "author": "Jean-Daniel Francoeur",
    "perspective": "ground"
  },
  "17837145": {
    "label": "Exterior",
    "author": "Vincent Rivaud",
    "perspective": "ground"
  },
  "19344663": {
    "label": "Vista al volcán",
    "author": "Paul Bill",
    "perspective": "drone"
  },
  "19515223": {
    "label": "Exterior",
    "author": "Marinella Grce Orell",
    "perspective": "ground"
  },
  "19627717": {
    "label": "Jardín",
    "author": "Andreas Ebner",
    "perspective": "ground"
  },
  "19938718": {
    "label": "Cascada",
    "author": "Jean Paul Montanaro",
    "perspective": "ground"
  },
  "19938719": {
    "label": "Entorno y vistas",
    "author": "Jean Paul Montanaro",
    "perspective": "drone"
  },
  "26618076": {
    "label": "Interior",
    "author": "Yunus Tuğ",
    "perspective": "ground"
  },
  "28003209": {
    "label": "Jardín",
    "author": "Railander Ramos",
    "perspective": "ground"
  },
  "28256945": {
    "label": "Interior",
    "author": "Damm aaaa",
    "perspective": "ground"
  },
  "28915352": {
    "label": "Exterior",
    "author": "Vero Benedini",
    "perspective": "ground"
  },
  "29000313": {
    "label": "Habitación",
    "author": "Quang Nguyen Vinh",
    "perspective": "ground"
  },
  "30319497": {
    "label": "Jardín",
    "author": "FOX ^.ᆽ.^= ∫",
    "perspective": "ground"
  },
  "30750576": {
    "label": "Interior",
    "author": "Quang Nguyen Vinh",
    "perspective": "ground"
  },
  "30750588": {
    "label": "Exterior",
    "author": "Quang Nguyen Vinh",
    "perspective": "ground"
  },
  "30750589": {
    "label": "Terraza",
    "author": "Quang Nguyen Vinh",
    "perspective": "ground"
  },
  "31387341": {
    "label": "Exterior",
    "author": "Vincent Rivaud",
    "perspective": "ground"
  },
  "31423342": {
    "label": "Sendero",
    "author": "Enrique Hidalgo",
    "perspective": "ground"
  },
  "31460167": {
    "label": "Exterior",
    "author": "Czarinah Philline Rayray",
    "perspective": "ground"
  },
  "31460168": {
    "label": "Vista general",
    "author": "Czarinah Philline Rayray",
    "perspective": "ground"
  },
  "32727439": {
    "label": "Exterior",
    "author": "Vincent Rivaud",
    "perspective": "ground"
  },
  "34104609": {
    "label": "Vista general",
    "author": "Keegan Checks",
    "perspective": "drone"
  },
  "34104610": {
    "label": "Vista general",
    "author": "Keegan Checks",
    "perspective": "drone"
  },
  "35642390": {
    "label": "Sendero",
    "author": "Jennifer Hernandez",
    "perspective": "ground"
  },
  "36183950": {
    "label": "Palmeras",
    "author": "Orphic Clicks",
    "perspective": "ground"
  },
  "36489532": {
    "label": "Interior",
    "author": "Mitchell Soeharsono",
    "perspective": "ground"
  }
};
const examples=[
  {
    "id": "lot-107",
    "es": "Villa del patio iluminado · demo",
    "en": "Villa with a glowing courtyard · demo",
    "place": "La Fortuna",
    "price": 565000,
    "area": 2250,
    "lat": 10.474,
    "lng": -84.645,
    "road": "Asfalto / concreto",
    "size": [
      330,
      4,
      4
    ],
    "water": "Conexión activa",
    "electricity": "Medidor activo",
    "terrain": "Mayormente plano",
    "photoIds": [
      28915352,
      29000313,
      28003209
    ]
  },
  {
    "id": "lot-108",
    "es": "Casa del deck y la piscina · demo",
    "en": "Poolside deck house · demo",
    "place": "Agua Azul",
    "price": 218000000,
    "currency": "CRC",
    "area": 1900,
    "lat": 10.493,
    "lng": -84.624,
    "size": [
      285,
      3,
      3
    ],
    "water": "Conexión activa",
    "electricity": "Medidor activo",
    "terrain": "Mayormente plano",
    "photoIds": [
      13914273,
      13914268,
      13914276,
      13914283
    ]
  },
  {
    "id": "lot-109",
    "es": "Cabaña de madera entre árboles · demo",
    "en": "Woodland timber cabin · demo",
    "place": "Chachagua",
    "price": 128000,
    "area": 1650,
    "lat": 10.395,
    "lng": -84.603,
    "size": [
      48,
      1,
      1
    ],
    "kind": "Cabaña",
    "water": "Conexión activa",
    "electricity": "Medidor activo",
    "terrain": "Mayormente plano",
    "photoIds": [
      30750588,
      30750589,
      30750576
    ]
  },
  {
    "id": "lot-110",
    "es": "Cabaña triangular con jardín · demo",
    "en": "A-frame garden cabin · demo",
    "place": "Sonafluca",
    "price": 48500000,
    "currency": "CRC",
    "area": 650,
    "lat": 10.429,
    "lng": -84.562,
    "size": [
      62,
      2,
      1
    ],
    "kind": "Cabaña",
    "residential": "residential",
    "water": "Conexión activa",
    "electricity": "Medidor activo",
    "terrain": "Mayormente plano",
    "photoIds": [
      31460167,
      31460168,
      8407009
    ]
  },
  {
    "id": "lot-111",
    "es": "Cabaña de palma en la arboleda · demo",
    "en": "Palm-roof cabin in the grove · demo",
    "place": "La Tigra",
    "price": 98000,
    "area": 3200,
    "lat": 10.343,
    "lng": -84.583,
    "size": [
      52,
      1,
      1
    ],
    "kind": "Cabaña",
    "well": true,
    "water": "No confirmado",
    "electricity": "Medidor activo",
    "terrain": "Mayormente plano",
    "photoIds": [
      16918575,
      16918564,
      30319497
    ]
  },
  {
    "id": "lot-112",
    "es": "Casita escondida en el jardín · demo",
    "en": "Little house in a hidden garden · demo",
    "place": "Chachagua",
    "price": 62000000,
    "currency": "CRC",
    "area": 1250,
    "lat": 10.413,
    "lng": -84.616,
    "size": [
      76,
      2,
      1
    ],
    "water": "Conexión activa",
    "electricity": "Medidor activo",
    "terrain": "Mayormente plano",
    "photoIds": [
      6063234,
      4917176,
      5652566
    ]
  },
  {
    "id": "lot-113",
    "es": "Casa de balcones y luz · demo",
    "en": "Light-filled balcony house · demo",
    "place": "El Tanque",
    "price": 375000,
    "area": 1450,
    "lat": 10.492,
    "lng": -84.583,
    "size": [
      240,
      3,
      2
    ],
    "road": "Asfalto / concreto",
    "water": "Conexión activa",
    "electricity": "Medidor activo",
    "terrain": "Mayormente plano",
    "photoIds": [
      31387341,
      28256945,
      3209035
    ]
  },
  {
    "id": "lot-114",
    "es": "Casa de enredaderas y piscina · demo",
    "en": "Vine-covered pool house · demo",
    "place": "La Fortuna",
    "price": 142000000,
    "currency": "CRC",
    "area": 980,
    "lat": 10.46,
    "lng": -84.651,
    "size": [
      175,
      2,
      2
    ],
    "road": "Asfalto / concreto",
    "water": "Conexión activa",
    "electricity": "Medidor activo",
    "terrain": "Mayormente plano",
    "photoIds": [
      17837145,
      26618076,
      9890614
    ]
  },
  {
    "id": "lot-115",
    "es": "Terraza de madera entre verdes · demo",
    "en": "Timber terrace in the greenery · demo",
    "place": "El Castillo",
    "price": 289000,
    "area": 3800,
    "lat": 10.418,
    "lng": -84.755,
    "size": [
      165,
      2,
      2
    ],
    "terrain": "Mixto",
    "water": "Conexión activa",
    "electricity": "Medidor activo",
    "photoIds": [
      4146874,
      16436925,
      8112338
    ]
  },
  {
    "id": "lot-116",
    "es": "Casa blanca con pérgola · demo",
    "en": "White house with a pergola · demo",
    "place": "El Tanque",
    "price": 116000000,
    "currency": "CRC",
    "area": 720,
    "lat": 10.476,
    "lng": -84.575,
    "size": [
      148,
      2,
      2
    ],
    "residential": "condo",
    "road": "Asfalto / concreto",
    "water": "Conexión activa",
    "electricity": "Medidor activo",
    "terrain": "Mayormente plano",
    "photoIds": [
      32727439,
      8089261,
      7873251
    ]
  },
  {
    "id": "lot-117",
    "es": "Dos villas entre palmeras · demo",
    "en": "Two villas among the palms · demo",
    "place": "Monterrey",
    "price": 690000,
    "area": 6200,
    "lat": 10.548,
    "lng": -84.64,
    "units": [
      [
        155,
        2,
        2
      ],
      [
        125,
        2,
        2
      ]
    ],
    "kind": "Casa",
    "use": "Alojamiento turístico",
    "water": "Conexión activa",
    "electricity": "Medidor activo",
    "terrain": "Mayormente plano",
    "photoIds": [
      34104609,
      34104610,
      36183950
    ]
  },
  {
    "id": "lot-118",
    "es": "Villa de arcos y agua azul · demo",
    "en": "Arched villa beside a blue pool · demo",
    "place": "Agua Azul",
    "price": 278000000,
    "currency": "CRC",
    "area": 2100,
    "lat": 10.505,
    "lng": -84.629,
    "size": [
      350,
      4,
      4
    ],
    "residential": "condo",
    "road": "Asfalto / concreto",
    "water": "Conexión activa",
    "electricity": "Medidor activo",
    "terrain": "Mayormente plano",
    "photoIds": [
      9730025,
      12715506,
      36489532
    ]
  },
  {
    "id": "lot-119",
    "es": "Refugio rústico bajo la lluvia · demo",
    "en": "Rustic rainy-day retreat · demo",
    "place": "La Tigra",
    "price": 139000,
    "area": 2600,
    "lat": 10.353,
    "lng": -84.601,
    "size": [
      85,
      2,
      1
    ],
    "kind": "Cabaña",
    "terrain": "Mixto",
    "road": "Tierra",
    "water": "Conexión activa",
    "electricity": "Medidor activo",
    "photoIds": [
      14817856,
      14025909,
      19627717
    ]
  },
  {
    "id": "lot-120",
    "es": "Casa al final del sendero · demo",
    "en": "House at the end of the path · demo",
    "place": "El Castillo",
    "price": 79500000,
    "currency": "CRC",
    "area": 3100,
    "lat": 10.424,
    "lng": -84.731,
    "size": [
      115,
      2,
      2
    ],
    "terrain": "Mixto",
    "road": "Tierra",
    "water": "Conexión activa",
    "electricity": "Medidor activo",
    "photoIds": [
      19515223,
      16262294,
      5769602
    ]
  },
  {
    "id": "lot-121",
    "es": "Finca de cultivos y horizonte · demo",
    "en": "Farmland with an open horizon · demo",
    "place": "Los Ángeles",
    "price": 390000,
    "area": 42000,
    "lat": 10.451,
    "lng": -84.521,
    "use": "Cultivos o ganadería",
    "well": true,
    "terrain": "Mayormente plano",
    "water": "No confirmado",
    "electricity": "Medidor activo",
    "photoIds": [
      10023263,
      10023264
    ]
  },
  {
    "id": "lot-122",
    "es": "Potreros de colinas suaves · demo",
    "en": "Pastures on rolling hills · demo",
    "place": "Monterrey",
    "price": 138000000,
    "currency": "CRC",
    "area": 56000,
    "lat": 10.557,
    "lng": -84.615,
    "use": "Cultivos o ganadería",
    "terrain": "Mixto",
    "water": "Carta de disponibilidad",
    "photoIds": [
      10999580,
      10999543
    ]
  },
  {
    "id": "lot-123",
    "es": "Finca abierta entre palmeras · demo",
    "en": "Open farmland among palms · demo",
    "place": "La Palmera",
    "price": 245000,
    "area": 28500,
    "lat": 10.482,
    "lng": -84.49,
    "use": "Cultivos o ganadería",
    "terrain": "Mayormente plano",
    "water": "Carta de disponibilidad",
    "electricity": "Medidor activo",
    "photoIds": [
      14510506,
      17302316,
      17302407
    ]
  },
  {
    "id": "lot-124",
    "es": "Jardín con el Arenal al fondo · demo",
    "en": "Garden with an Arenal backdrop · demo",
    "place": "La Fortuna",
    "price": 54500000,
    "currency": "CRC",
    "area": 2400,
    "lat": 10.462,
    "lng": -84.674,
    "volcano": true,
    "water": "Carta de disponibilidad",
    "electricity": "Medidor activo",
    "photoIds": [
      4807058,
      19344663
    ]
  },
  {
    "id": "lot-125",
    "es": "Ladera mirando al volcán · demo",
    "en": "Hillside facing the volcano · demo",
    "place": "El Castillo",
    "price": 179000,
    "area": 10800,
    "lat": 10.427,
    "lng": -84.756,
    "terrain": "Mayormente inclinado",
    "volcano": true,
    "photoIds": [
      834958,
      13068962,
      923228
    ]
  },
  {
    "id": "lot-126",
    "es": "Pradera con horizonte de lago · demo",
    "en": "Meadow with a lake horizon · demo",
    "place": "El Castillo",
    "price": 84000000,
    "currency": "CRC",
    "area": 8500,
    "lat": 10.444,
    "lng": -84.782,
    "terrain": "Mixto",
    "water": "Carta de disponibilidad",
    "photoIds": [
      5819273,
      5819320
    ]
  },
  {
    "id": "lot-127",
    "es": "Parcela junto al agua tranquila · demo",
    "en": "Land beside calm water · demo",
    "place": "Sonafluca",
    "price": 89000,
    "area": 6400,
    "lat": 10.422,
    "lng": -84.548,
    "river": true,
    "terrain": "Mayormente plano",
    "water": "No confirmado",
    "road": "Tierra",
    "photoIds": [
      12800406,
      6198925
    ]
  },
  {
    "id": "lot-128",
    "es": "Bosque para caminar sin prisa · demo",
    "en": "Forest for unhurried walks · demo",
    "place": "La Tigra",
    "price": 97000000,
    "currency": "CRC",
    "area": 23000,
    "lat": 10.335,
    "lng": -84.611,
    "terrain": "Mayormente inclinado",
    "photoIds": [
      35642390,
      31423342
    ]
  },
  {
    "id": "lot-129",
    "es": "Terreno junto al camino rural · demo",
    "en": "Land beside a country lane · demo",
    "place": "Chachagua",
    "price": 52000,
    "area": 1350,
    "lat": 10.385,
    "lng": -84.615,
    "terrain": "Mixto",
    "water": "Carta de disponibilidad",
    "electricity": "Medidor activo",
    "road": "Tierra",
    "use": "Sin uso",
    "photoIds": [
      17302380,
      9890614,
      17302407
    ]
  },
  {
    "id": "lot-130",
    "es": "Bosque de agua y cascadas · demo",
    "en": "Forest of water and waterfalls · demo",
    "place": "La Fortuna",
    "price": 185000000,
    "currency": "CRC",
    "area": 35000,
    "lat": 10.433,
    "lng": -84.667,
    "terrain": "Mayormente inclinado",
    "river": true,
    "photoIds": [
      19938718,
      16863800
    ]
  },
  {
    "id": "lot-131",
    "es": "Colina de bosque y atardeceres · demo",
    "en": "Forested sunset hill · demo",
    "place": "Monterrey",
    "price": 168000,
    "area": 15600,
    "lat": 10.568,
    "lng": -84.653,
    "terrain": "Mixto",
    "well": true,
    "photoIds": [
      19938719,
      17302316,
      5652566
    ]
  }
];
export const collectionDemos=examples.map(({size,units,kind='Casa',photoIds,...data})=>{
  const buildings=(units||(size?[size]:[])).map(([area,bedrooms,bathrooms],index)=>building('building-'+(index+1),index?'Casa de huéspedes':kind==='Cabaña'?'Cabaña principal':'Casa principal',kind,area,bedrooms,bathrooms));
  const images=photoIds.map(id=>{const ref=references[id];return photo('collection-'+id,ref.label,ref.author,ref.perspective);});
  // Keep the cover first; separate indoor references from the setting where useful.
  const groups=[group('overview',references[photoIds[0]].label,[images[0]])];
  for(let i=1;i<images.length;i++){
    const label=references[photoIds[i]].label,previous=groups.at(-1);
    if(i>1&&previous.title===label+' · imágenes de referencia')previous.photos.push(images[i]);
    else groups.push(group('reference-'+i,label,[images[i]]));
  }
  return showcase({...data,buildings,groups});
});

