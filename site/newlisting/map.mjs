export function syncEntranceMarker(controller,values,validPoint,createMarker,setStatus) {
  if(!validPoint(values)) {
    controller.marker?.remove();controller.marker=null;
    setStatus('Todavía no hay una entrada marcada. Elegí un punto o ingresá coordenadas.');
    return;
  }
  const point=[Number(values.lng),Number(values.lat)];
  if(!controller.marker)controller.marker=createMarker(point);
  else controller.marker.setLngLat(point);
  setStatus(values.exact?'Entrada confirmada.':'Entrada marcada. Comprobá el lugar y confirmalo abajo.');
}
export function mountMap(element,values,onPoint,setStatus,lib=globalThis.maplibregl) {
  const controller={marker:null,map:null};
  const valid=v=>['lat','lng'].every((k,i)=>typeof v[k]==='string'&&v[k].trim()!==''&&Number.isFinite(Number(v[k]))&&Math.abs(Number(v[k]))<=[90,180][i]);
  const unavailable=()=>setStatus('Mapa no disponible. Podés ingresar las coordenadas de la entrada.');
  if(!lib){unavailable();return {update(){},remove(){},center(){}};}
  try {
    controller.map=new lib.Map({locale:{'NavigationControl.ZoomIn':'Acercar','NavigationControl.ZoomOut':'Alejar'},container:element,center:valid(values)?[Number(values.lng),Number(values.lat)]:[-84.645,10.469],zoom:valid(values)?16:11,style:{version:8,sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,attribution:'© OpenStreetMap contributors'}},layers:[{id:'osm',type:'raster',source:'osm'}]}});
    controller.map.addControl(new lib.NavigationControl({showCompass:false}));
    controller.map.on('click',e=>{const p=e.lngLat.wrap();onPoint(p.lng,p.lat,'map');});
    controller.map.on('error',unavailable);
    const update=v=>syncEntranceMarker(controller,v,valid,point=>{
      const marker=new lib.Marker({draggable:true,color:'#284f3d'}).setLngLat(point).addTo(controller.map);
      marker.on('dragend',()=>{const p=marker.getLngLat().wrap();onPoint(p.lng,p.lat,'map');});return marker;
    },setStatus);
    update(values);
    return {update,center(v){if(valid(v))controller.map.jumpTo({center:[Number(v.lng),Number(v.lat)],zoom:16});},remove(){controller.marker?.remove();controller.map.remove();}};
  }catch{controller.map?.remove();unavailable();return {update(){},remove(){},center(){}};}
}
