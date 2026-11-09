import {newDraft} from '../site/newlisting/model.mjs';
export const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5l8AAAAASUVORK5CYII=','base64'));
export const pdf=new TextEncoder().encode('%PDF-1.7\nfixture');
export function completeDraft(){
  const d=newDraft('test-property-01');
  d.values={buildings:'no',lat:'10.47',lng:'-84.64',exact:true,location_method:'map',area:'1000',terrain:'unknown',road:'unknown',access:'unknown',water:'unknown',electricity:'unknown',price:'100000',currency:'USD',contact:'Test seller',email:'seller@example.com',role:'owner',authorization:true,location_consent:true,photo_permission:true,cover_id:'land-1'};
  d.files=[['land-1','land','general'],['land-2','land','general'],['entry-1','access','entrance'],['road-1','access','road'],['plan-1','plan_file','general']].map(([id,category,shot])=>({id,category,shot,name:id+(category==='plan_file'?'.pdf':'.png'),type:category==='plan_file'?'application/pdf':'image/png',size:category==='plan_file'?pdf.length:png.length,perspective:'ground',buildingId:'',blob:new Blob([category==='plan_file'?pdf:png],{type:category==='plan_file'?'application/pdf':'image/png'})}));
  return d;
}
