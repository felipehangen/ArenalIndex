import {completeDraft} from './intake-fixtures.mjs';
import {createPublication} from '../server/intake/publication.mjs';

export function approvedRow(){
  const payload=completeDraft();
  Object.assign(payload.values,{buildings:'yes',listing_title:'Un jardín frente al Arenal',current_use:'Recreación / descanso',area:'3250',terrain:'Mixto',usable:'1800',inspected:'yes',road:'Lastre',access:'private',private_length:'120',private_surface:'Lastre',legal_access:'supplied',driveway:'yes',driveway_surface:'Lastre',volcano:'Completa',waterbody:'Cerca, fuera de la propiedad',residential:'residential',fees:'Sin cuota reportada',water:'active',water_provider:'ASADA de la comunidad',water_source:'document',well:'no',electricity:'active',electric_provider:'ICE',electricity_source:'observed',internet:'installed',internet_technology:'Fibra',mobile:'tested',mobile_operator:'Kölbi',mobile_network:'4G',sewage:'Tanque séptico',rainwater:'Hay cunetas o drenajes',landuse_status:'requested',tax_status:'unverified',price:'185000',currency:'USD',negotiable:'Consultar',financing:'No',terms:'Incluye las dos construcciones. Mobiliario por acordar.',cover_id:'view-1'});
  payload.buildings=[{id:'house',kind:'house',name:'Casa principal',area:'120',bedrooms:'2',bathrooms:'2'},{id:'cabin',kind:'cabin',name:'Cabaña del jardín',area:'36',bedrooms:'1',bathrooms:'1'}];
  for(const [id,category,buildingId,perspective] of [['house-1','buildings','house','ground'],['cabin-1','buildings','cabin','ground'],['view-1','surroundings','','ground'],['drone-1','land','','drone']])payload.files.push({...payload.files[0],id,category,buildingId,perspective,shot:buildingId?'exterior':'general'});
  return {id:payload.id,payload,version:2,status:'approved',reviewed_at:'2026-11-09T20:00:00Z',review:{plan_number:'PRIVATE-PLAN',documented_area:3200,plan_matches:true,discrepancy_resolved:true,copy_checked:true,inspection:{rain_access:{state:'reported',note:'En época lluviosa se recomienda un vehículo alto.'}}}};
}
export const editorial={title:'Un jardín frente al Arenal',place:'El Castillo · La Fortuna',description:'Un terreno amplio, dos espacios independientes y el Arenal en el horizonte. La casa principal y la cabaña se distribuyen entre jardines y áreas abiertas, con una llegada por camino de lastre.\n\nUn ejemplo de cómo presentamos la propiedad: fotos por tema, información con su fuente y condiciones claras para planear una visita.',whatsapp:''};
export function sampleListing(){
  const {listing}=createPublication(approvedRow(),editorial,{apiURL:'https://example.test/api/listings'});
  const paths={'land-1':'photos/lot.jpg','land-2':'photos/tropical-plot.jpg','entry-1':'photos/tropical-plot.jpg','road-1':'photos/lot.jpg','house-1':'photos/house.jpg','cabin-1':'photos/house.jpg','view-1':'photos/garden-volcano.jpg','drone-1':'photos/lot.jpg'};
  for(const group of listing.details.photoGroups)for(const photo of group.photos)photo.src=paths[photo.id];
  listing.images=['photos/garden-volcano.jpg','photos/house.jpg','photos/tropical-plot.jpg','photos/lot.jpg'];
  listing.is_demo=true;return listing;
}
