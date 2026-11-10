/* Keep the actual button (and its click target) alive across map move/idle events. */
window.ArenalMarkerStore = class {
  constructor(map, Marker) {
    this.map=map;this.Marker=Marker;this.entries=new Map();this.seen=new Set();
  }
  begin() { this.seen.clear(); }
  use(key, feature, createButton, offset=[0,0]) {
    this.seen.add(key);
    let entry=this.entries.get(key);
    if(!entry){
      const button=createButton();
      entry={button,marker:new this.Marker({element:button}).setLngLat(feature.geometry.coordinates).addTo(this.map)};
      this.entries.set(key,entry);
    } else if(entry.coordinates.some((value,i)=>value!==feature.geometry.coordinates[i])) {
      entry.marker.setLngLat(feature.geometry.coordinates);
    }
    entry.coordinates=[...feature.geometry.coordinates];
    if(!entry.offset||entry.offset.some((value,i)=>value!==offset[i]))entry.marker.setOffset?.(offset);
    entry.offset=[...offset];
    entry.feature=feature;
    return entry;
  }
  end() {
    for(const [key,entry] of this.entries){
      if(!this.seen.has(key)){entry.marker.remove();this.entries.delete(key);}
    }
  }
};

/* Collisions combine membership instead of dropping a property's marker.
   Prices may shrink to dots; every group still owns all its source features. */
window.ArenalMarkerLayout = (() => {
  const count=feature=>Number(feature.properties.adCount||feature.properties.listingCount||feature.properties.point_count)||1;
  const key=feature=>feature.properties.cluster?'cluster-'+feature.properties.cluster_id:feature.properties.id;
  const intersects=(a,b,gap=4)=>Math.abs(a.x-b.x)<a.half+b.half+gap&&Math.abs(a.y-b.y)<a.hh+b.hh+gap;
  function layout({features,project,width,height,landmarks=[],overlays=[],priceWidth=()=>0}){
    const covered=rect=>overlays.some(r=>rect.x+rect.half>r.left&&rect.x-rect.half<r.right&&rect.y+rect.hh>r.top&&rect.y-rect.hh<r.bottom);
    const inside=rect=>rect.x-rect.half>=2&&rect.x+rect.half<=width-2&&rect.y-rect.hh>=2&&rect.y+rect.hh<=height-2;
    function fit(point){
      const natural={...point,half:22,hh:22};
      if(inside(natural)&&!covered(natural))return natural;
      const xs=[point.x,24,width-24],ys=[point.y,24,height-24];
      for(const r of overlays){xs.push(r.left-26,r.right+26);ys.push(r.top-26,r.bottom+26);}
      const candidates=xs.flatMap(x=>ys.map(y=>({x,y,half:22,hh:22}))).filter(p=>inside(p)&&!covered(p));
      candidates.sort((a,b)=>(a.x-point.x)**2+(a.y-point.y)**2-((b.x-point.x)**2+(b.y-point.y)**2));
      return candidates[0];
    }
    const references=landmarks.map(reference=>{
      const p=project(reference.coordinates);
      // Reserve room for both the reference icon and its listing-count badge.
      const rect={x:p.x+7,y:p.y-32,half:31,hh:36};
      return {reference,...rect,features:[],count:0,visible:inside(rect)&&!covered(rect)};
    });
    const visibleReferences=[];
    for(const r of references){
      if(r.visible&&visibleReferences.some(other=>intersects(r,other)))r.visible=false;
      if(r.visible)visibleReferences.push(r);
    }
    const groups=[],unique=[...new Map(features.map(f=>[key(f),f])).values()];
    unique.sort((a,b)=>count(b)-count(a)||String(key(a)).localeCompare(String(key(b))));
    for(const feature of unique){
      const original=project(feature.geometry.coordinates);
      if(original.x<0||original.x>width||original.y<0||original.y>height)continue;
      const point=fit(original);
      if(!point)continue; // No exposed map surface, e.g. the fully raised mobile sheet.
      let group=references.filter(r=>r.visible&&intersects(point,r)).sort((a,b)=>Math.hypot(a.x-point.x,a.y-point.y)-Math.hypot(b.x-point.x,b.y-point.y))[0];
      group??=groups.find(g=>intersects(point,g));
      if(!group){
        group={key:key(feature),coordinates:feature.geometry.coordinates,offset:[point.x-original.x,point.y-original.y],...point,features:[],count:0};
        groups.push(group);
      }
      group.features.push(feature);group.count+=count(feature);
    }
    const occupied=[...references.filter(r=>r.visible),...groups];let prices=0;
    for(const group of groups){
      const half=Math.max(22,priceWidth(group.features[0])/2),label={...group,half};
      group.price=group.count===1&&prices<14&&inside(label)&&!covered(label)&&!occupied.some(other=>other!==group&&intersects(label,other));
      if(group.price){group.half=half;prices++;}
    }
    return {groups,references};
  }
  async function listingIds(features,source){
    const leaves=(await Promise.all(features.map(f=>f.properties.cluster?source.getClusterLeaves(Number(f.properties.cluster_id),Number(f.properties.point_count)||count(f),0):[f]))).flat();
    return [...new Set(leaves.flatMap(f=>f.properties.listingIds?JSON.parse(f.properties.listingIds):[f.properties.id]))];
  }
  return {layout,count,key,listingIds};
})();
