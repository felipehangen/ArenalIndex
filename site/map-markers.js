/* Keep the actual button (and its click target) alive across map move/idle events. */
window.ArenalMarkerStore = class {
  constructor(map, Marker) {
    this.map=map;this.Marker=Marker;this.entries=new Map();this.seen=new Set();
  }
  begin() { this.seen.clear(); }
  use(key, feature, createButton) {
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
    entry.feature=feature;
    return entry;
  }
  end() {
    for(const [key,entry] of this.entries){
      if(!this.seen.has(key)){entry.marker.remove();this.entries.delete(key);}
    }
  }
};
