import {esc,safeImage} from '../../admin/view.mjs?v=10-broker-tools';
export function renderSheet(listing,{language='es',collection=null,url}={}){
  const en=language==='en',t=(es,enText)=>en?enText:es,locale=en?'en-US':'es-CR';
  const translated=listing.details?.translations?.[language];
  const title=translated?.title||listing.name,description=translated?.description||listing.description;
  const money=Number.isFinite(listing.price)&&['USD','CRC'].includes(listing.currency)?new Intl.NumberFormat(locale,{style:'currency',currency:listing.currency,maximumFractionDigits:0}).format(listing.price):t('Consultar','Ask for price');
  const area=Number.isFinite(listing.area)?new Intl.NumberFormat(locale).format(listing.area)+' m²':'—';
  const cover=safeImage(listing.images?.[0]),contact=listing.details?.contact||{};
  const contacts=[contact.name,contact.phone,contact.whatsapp&&contact.whatsapp!==contact.phone?'WhatsApp: '+contact.whatsapp:'',contact.email].filter(value=>typeof value==='string'&&value.trim());
  return '<p class="sheet-brand">arenal <small>INDEX</small></p>'+(collection?'<p class="sheet-collection">'+t('Propiedades de','Properties from')+' '+esc(collection.name)+'</p>':'')+'<h1>'+esc(title)+'</h1><p class="sheet-place">'+esc(listing.place)+'</p>'+
    (listing.is_demo?'<p class="sheet-demo">'+t('Propiedad de demostración. Información e imágenes ilustrativas; no es una oferta de venta.','Demonstration property. Illustrative information and images; this is not an offer for sale.')+'</p>':'')+
    (cover?'<img class="sheet-cover" src="'+esc(cover)+'" alt="'+esc(title)+'" width="770" height="280" referrerpolicy="no-referrer">':'')+
    '<dl class="sheet-facts"><div><dt>'+t('Precio','Price')+'</dt><dd>'+esc(money)+'</dd></div><div><dt>'+t('Área del terreno','Land area')+'</dt><dd>'+esc(area)+'</dd></div></dl>'+
    '<p class="sheet-description">'+esc(description)+'</p><section class="sheet-contact"><h2>'+t('Contacto','Contact')+'</h2>'+(contacts.length?contacts.map(value=>'<p>'+esc(value)+'</p>').join(''):'<p>'+t('Consultá el contacto en el anuncio público.','See contact information in the public listing.')+'</p>')+'</section>'+
    '<footer class="sheet-footer"><p>'+t('Consultá el anuncio para ver fotos, ubicación y disponibilidad actual.','See the listing for photos, location, and current availability.')+'</p><a href="'+esc(url)+'">'+esc(url)+'</a></footer>';
}
