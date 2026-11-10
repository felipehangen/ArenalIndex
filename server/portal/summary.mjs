import {reference} from '../../site/newlisting/model.mjs';
export function recordSummary(row){
  const values=row.payload?.values||{};
  return {...(row.is_demo===true?{isDemo:true,isWorkspace:true}:{}),id:row.id,title:row.editorial?.title||values.listing_title||reference(row.payload),contact:values.contact||'',email:values.email||'',price:Number(values.price)||null,currency:values.currency||'USD',area:Number(values.area)||null,status:row.status,version:row.version,updatedAt:row.updated_at||null,publishedVersion:row.publication?.version||null,publicId:row.publication?.listing?.id||null,editRevision:row.edit_revision||0,publicationRevision:row.publication_revision||0,withdrawn:!row.publication&&!!row.unlisted_at,notificationSent:row.notification_sent===true};
}
