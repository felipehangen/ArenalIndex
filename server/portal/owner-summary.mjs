import {recordSummary} from './summary.mjs';
import {photoTour,validSignature} from '../../site/newlisting/model.mjs';
import {filePath} from './workspace.mjs';

// Only the account's photo tour is eligible; private document images never are.
export async function ownerSummary(row,repository){
  const summary=recordSummary(row);
  let thumbnail=null;
  try{
    const draft={values:{},files:[],buildings:[],...row.payload};
    const photos=photoTour(draft).flatMap(group=>group.files);
    const cover=photos.find(file=>file.id===draft.values.cover_id)||photos[0];
    if(cover){
      const path=filePath(row,cover);
      let available=true;
      if(!row.last_save_id&&row.status==='draft'){
        const object=await repository.inspectFile(path,cover);
        available=object?.size===cover.size&&validSignature(cover.type,object.bytes,object.size);
      }
      if(available)thumbnail=await repository.downloadURL(path);
    }
  }catch{ /* A missing photo must not prevent access to the listing. */ }
  return {...summary,thumbnail};
}
