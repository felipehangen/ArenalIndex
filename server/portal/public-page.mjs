import {createHash} from 'node:crypto';
import {withShareURL} from '../sharing/links.mjs';

// A public identifier derived from immutable account identity, never its email or name.
export const publicAccountKey = account => 'a-'+createHash('sha256').update('arenal-public-account:'+account.subject).digest('hex').slice(0,24);
const hash=value=>createHash('sha256').update(value).digest('hex');
const slugBase=account=>account.name.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70).replace(/-$/,'')||'collection';
export async function ensureAccountSlug(repository,account){
  if(account.public_slug||!account.name?.trim())return account;
  const base=slugBase(account);
  for(const slug of [base,base+'-'+hash(account.subject).slice(0,8),base+'-'+hash(account.subject).slice(0,24)]){
    const claim=await repository.portalCreate('account-slugs',hash(slug),{subject:account.subject,slug})||await repository.portalGet('account-slugs',hash(slug));
    if(claim?.subject!==account.subject)continue;
    const updated=await repository.portalUpdate('accounts',hash(account.subject),{public_slug:account.public_slug},{public_slug:slug});
    if(updated)return updated;
    const current=await repository.portalGet('accounts',hash(account.subject));
    if(current?.public_slug)return current;
    throw Error('Account slug assignment unavailable');
  }
  throw Error('Account slug unavailable');
}
export function publicAccountProfile(account){
  if(!account?.active||typeof account.name!=='string'||!account.name.trim())return null;
  const key=publicAccountKey(account),slug=account.public_slug||slugBase(account);
  return {key,slug,name:account.name,url:'https://go.arenalindex.com/collection/'+slug+'/'};
}
export async function publicAccountPage(repository,key){
  if(!/^[a-z0-9][a-z0-9-]{0,99}$/.test(key||''))return null;
  const matches=(await repository.ownerAccounts()).filter(account=>publicAccountKey(account)===key||account.public_slug===key);
  if(matches.length!==1)return null;
  const account=matches[0],profile=publicAccountProfile(account);
  if(!profile)return null;
  const listings=[],seen=new Set(),cursors=new Set();let cursor;
  do{
    const page=await repository.ownerRecords(account.subject,cursor);
    for(const row of page.records){
      // Read the published snapshot, including while a newer draft is being edited.
      if(row.owner_subject!==account.subject||row.status==='deleted'||!row.publication?.listing)continue;
      const listing=row.publication.listing;
      if(!seen.has(listing.id)){seen.add(listing.id);listings.push(withShareURL(listing));}
    }
    cursor=page.cursor;
    if(cursor&&cursors.has(cursor))throw Error('Repeated account cursor');
    cursors.add(cursor);
  }while(cursor);
  return {account:profile,listings};
}
