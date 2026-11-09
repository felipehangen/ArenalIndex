import {visible,photoTour,photoCaption,areaDifference} from './model.mjs';

export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderField(f,values={},prefix=''){
  const e=escapeHTML,value=values[f.id]??'',id='field-'+prefix+f.id;
  const attrs=' id="'+e(id)+'" data-key="'+f.id+'"'+(prefix?' data-building="'+e(prefix.slice(0,-1))+'"':'')+(f.required?' aria-required="true"':'');
  if(f.type==='checkbox')return '<div class="field wide checkbox-field"><label><input type="checkbox"'+attrs+(value?' checked':'')+'>'+e(f.label)+'</label></div>';
  let control;
  if(f.options)control='<select'+attrs+'>'+f.options.filter(([v])=>!f.known||v!=='unknown'||value==='unknown').map(([v,l])=>'<option value="'+e(v)+'"'+(v===value?' selected':'')+'>'+e(l)+'</option>').join('')+'</select>';
  else if(f.type==='textarea')control='<textarea'+attrs+' maxlength="'+f.maxLength+'" placeholder="Opcional">'+e(value)+'</textarea>';
  else control='<input'+attrs+' type="'+f.type+'" value="'+e(value)+'"'+(f.maxLength?' maxlength="'+f.maxLength+'"':'')+(f.type==='number'?' min="'+f.min+'" max="'+f.max+'" step="'+f.step+'" inputmode="decimal"':'')+' placeholder="'+e(f.placeholder||'')+'">';
  return '<div class="field'+(f.wide?' wide':'')+'" data-visible="'+f.id+'"'+(!visible(f,values)?' hidden':'')+'><label for="'+e(id)+'">'+e(f.label)+(f.required?' <span class="required-label">Necesario</span>':f.optional?' <span class="optional">Opcional</span>':'')+'</label>'+control+(f.help?'<small>'+e(f.help)+'</small>':'')+'</div>';
}
export function areaNotice(values){
  const difference=areaDifference(values),format=value=>new Intl.NumberFormat('es-CR',{maximumFractionDigits:2}).format(value);
  return difference?'El área declarada ('+format(difference.declared)+' m²) y la indicada en el plano ('+format(difference.documented)+' m²) son distintas. Podés enviar la ficha; aclararemos la diferencia antes de publicar.':'';
}
export function renderFields(items,values={},prefix=''){
  const sections=[];let current={fields:[]};
  for(const item of items){if(item.type==='group'){if(current.fields.length)sections.push(current);current={...item,fields:[]};}else current.fields.push(item);}
  if(current.fields.length)sections.push(current);
  const grid=fields=>'<div class="form-grid">'+fields.map(f=>renderField(f,values,prefix)).join('')+'</div>';
  const details=(fields,title,help='',openWhen)=>'<details class="optional-section"'+(openWhen?' data-conditional-group="'+escapeHTML(openWhen.key)+'"':'')+(fields.some(f=>visible(f,values)&&values[f.id]!==undefined&&values[f.id]!=='')||openWhen?.values.includes(values[openWhen.key])?' open':'')+'><summary>'+escapeHTML(title.replace(/ · opcional$/i,''))+' <span>Opcional</span></summary>'+(help?'<p class="optional-help">'+escapeHTML(help)+'</p>':'')+grid(fields)+'</details>';
  return sections.map(section=>{
    const primary=section.fields.filter(f=>f.required||!f.optional||f.prominent),secondary=section.fields.filter(f=>!primary.includes(f));
    const heading=section.label?'<header class="form-section-title"><h2>'+escapeHTML(section.label)+'</h2>'+(section.help?'<p>'+escapeHTML(section.help)+'</p>':'')+'</header>':'';
    if(!primary.length)return heading+details(secondary,'Agregar detalles','',section.openWhen);
    return heading+grid(primary)+(secondary.length?details(secondary,'Agregar más detalles'): '');
  }).join('');
}
export function renderPhotoTour(draft,urlFor=file=>file.url){
  const e=escapeHTML,sections=photoTour(draft),cover=sections.flatMap(section=>section.files).find(file=>file.id===draft.values.cover_id);
  const photo=(file,isCover=false)=>'<figure'+(isCover?' class="tour-cover"':'')+'><a href="'+e(urlFor(file))+'" target="_blank" rel="noopener noreferrer"><img src="'+e(urlFor(file))+'" alt="'+e(photoCaption(file,draft))+'" loading="lazy"></a><figcaption>'+(isCover?'<strong>Portada</strong> · ':'')+e(photoCaption(file,draft))+'</figcaption></figure>';
  return (cover?photo(cover,true):'')+sections.map(section=>'<section class="tour-section"><h3>'+e(section.title)+'</h3><div class="review-photo-grid">'+section.files.map(file=>photo(file)).join('')+'</div></section>').join('');
}
