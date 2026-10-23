import {validateDocument} from './cms-schema.ts';
export type Location={site:string;kind:string;key:string};
const conflict=()=>Object.assign(Error('This draft changed in another window. Reload before saving or publishing.'),{status:409});
export async function saveDraft(db:D1Database,location:Location,content:unknown,expectedVersion:number,actor:string){
 const {site,kind,key}=location;
 if(!Number.isInteger(expectedVersion)||expectedVersion<0)throw Object.assign(Error('Reload the draft before saving.'),{status:400});
 if((content as any)?.schema===1)content=validateDocument(kind,content);
 const encoded=JSON.stringify(content);if(!encoded||encoded.length>200000)throw Object.assign(Error('Content exceeds the page size limit.'),{status:400});
 const version=expectedVersion+1;
 const result=await db.batch([
  db.prepare('INSERT INTO cms_entries(site,kind,entry_key,content,version) VALUES(?,?,?,?,?) ON CONFLICT(site,kind,entry_key) DO UPDATE SET content=excluded.content,version=excluded.version,updated_at=CURRENT_TIMESTAMP WHERE cms_entries.version=?').bind(site,kind,key,encoded,version,expectedVersion),
  db.prepare('INSERT INTO cms_revisions(site,kind,entry_key,version,content,editor) SELECT site,kind,entry_key,version,content,? FROM cms_entries WHERE site=? AND kind=? AND entry_key=? AND version=? AND changes()>0').bind(actor,site,kind,key,version),
  db.prepare("INSERT INTO cms_audit(actor,action,target) SELECT ?,'save',? WHERE changes()>0").bind(actor,site+'/'+kind+'/'+key)
 ]);
 if(!result[0].meta.changes)throw conflict();
 return {ok:true,version};
}
export async function publishDraft(db:D1Database,location:Location,expectedVersion:number,actor:string){
 const {site,kind,key}=location;
 const row=await db.prepare('SELECT content,version FROM cms_entries WHERE site=? AND kind=? AND entry_key=?').bind(site,kind,key).first<{content:string;version:number}>();
 if(!row||row.version!==expectedVersion)throw conflict();
 validateDocument(kind,JSON.parse(row.content));
 const result=await db.batch([
  db.prepare('INSERT INTO cms_publications(site,kind,entry_key,content,revision_version,published_by) SELECT site,kind,entry_key,content,version,? FROM cms_entries WHERE site=? AND kind=? AND entry_key=? AND version=? ON CONFLICT(site,kind,entry_key) DO UPDATE SET content=excluded.content,revision_version=excluded.revision_version,published_by=excluded.published_by,published_at=CURRENT_TIMESTAMP').bind(actor,site,kind,key,expectedVersion),
  db.prepare('INSERT INTO cms_publication_history(site,kind,entry_key,content,revision_version,published_by) SELECT site,kind,entry_key,content,revision_version,published_by FROM cms_publications WHERE site=? AND kind=? AND entry_key=? AND changes()>0').bind(site,kind,key),
  db.prepare("INSERT INTO cms_audit(actor,action,target) SELECT ?,'publish',? WHERE changes()>0").bind(actor,site+'/'+kind+'/'+key)
 ]);
 if(!result[0].meta.changes)throw conflict();
 return {ok:true,published:true,version:expectedVersion};
}
export async function restoreDraft(db:D1Database,location:Location,revisionId:number,expectedVersion:number,actor:string){
 const {site,kind,key}=location;
 const row=await db.prepare('SELECT content FROM cms_revisions WHERE id=? AND site=? AND kind=? AND entry_key=?').bind(revisionId,site,kind,key).first<{content:string}>();
 if(!row)throw Object.assign(Error('Revision not found.'),{status:404});
 return saveDraft(db,location,JSON.parse(row.content),expectedVersion,actor);
}
