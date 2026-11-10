// Only a publication withdrawn by its account can be restored by that account.
// The saved snapshot is immutable; edited drafts must go through review again.
export function canRelist(row){
  return !!row.unlisted_at&&!row.publication&&['draft','approved','published'].includes(row.status)&&
    !!row.relist_publication?.listing&&row.relist_publication.version===row.version&&
    row.relist_owner===row.owner_subject&&!!row.owner_subject;
}
