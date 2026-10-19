import type { StorageEnv } from "./storage-retention-service";
import { registerStoredMedia } from "./storage-retention-service";
import type { ServiceResult } from "./prayer-service";

export interface MultipartPartInput { partNumber: number; etag: string; }

function validPart(n: number): boolean { return Number.isInteger(n) && n >= 1 && n <= 10000; }
function validKey(key: string): boolean { return /^media\/\d+\/[A-Za-z0-9._/-]+$/.test(key); }

export async function createMultipartUpload(
  env: StorageEnv,
  mediaId: number,
  contentType: string,
): Promise<ServiceResult<{ uploadId: number; r2UploadId: string; storageKey: string }>> {
  if (!env.MEDIA_R2) return { success: false, error: "R2 media storage is not configured." };
  const media = await env.DB.prepare(
    "SELECT media_id, file_type, storage_status FROM media WHERE media_id=?"
  ).bind(mediaId).first<any>();
  if (!media) return { success: false, error: "Media not found." };
  if (media.storage_status === "stored") return { success: false, error: "Media already has a stored object." };
  const allowed = new Set(["image", "video", "audio", "document"]);
  if (!allowed.has(media.file_type)) return { success: false, error: "Invalid media type." };
  const ct = String(contentType || "application/octet-stream").split(";")[0].trim().toLowerCase();
  const prefix = media.file_type === "image" ? "image/" : media.file_type === "video" ? "video/" : media.file_type === "audio" ? "audio/" : "application/";
  if (media.file_type !== "document" && !ct.startsWith(prefix)) return { success: false, error: "Content-Type does not match the registered media type." };

  const key = `media/${mediaId}/${crypto.randomUUID()}.upload`;
  const mpu = await env.MEDIA_R2.createMultipartUpload(key, { httpMetadata: { contentType: ct } });
  try {
    const row = await env.DB.prepare(
      `INSERT INTO media_multipart_uploads (media_id, r2_upload_id, storage_key, content_type)
       VALUES (?, ?, ?, ?) RETURNING upload_id`
    ).bind(mediaId, mpu.uploadId, key, ct).first<{ upload_id:number }>();
    if (!row) throw new Error("Failed to record multipart upload.");
    return { success:true, data:{ uploadId:row.upload_id, r2UploadId:mpu.uploadId, storageKey:key } };
  } catch (e) {
    try { await mpu.abort(); } catch {}
    return { success:false, error:"Failed to initialize multipart upload." };
  }
}

async function getSession(env: StorageEnv, mediaId: number, dbUploadId: number, r2UploadId: string) {
  return env.DB.prepare(
    `SELECT upload_id, media_id, r2_upload_id, storage_key, status, content_type
     FROM media_multipart_uploads WHERE upload_id=? AND media_id=? AND r2_upload_id=?`
  ).bind(dbUploadId, mediaId, r2UploadId).first<any>();
}

export async function uploadMultipartPart(
  env: StorageEnv, mediaId:number, dbUploadId:number, r2UploadId:string, partNumber:number, body:ReadableStream<Uint8Array>|null
): Promise<ServiceResult<{partNumber:number; etag:string}>> {
  if (!env.MEDIA_R2) return {success:false,error:"R2 media storage is not configured."};
  if (!validPart(partNumber)) return {success:false,error:"partNumber must be between 1 and 10000."};
  if (!body) return {success:false,error:"Request body is required."};
  const session = await getSession(env, mediaId, dbUploadId, r2UploadId);
  if (!session || session.status !== "initiated") return {success:false,error:"Multipart upload session is unavailable."};
  const mpu = env.MEDIA_R2.resumeMultipartUpload(session.storage_key, session.r2_upload_id);
  try {
    const part = await mpu.uploadPart(partNumber, body);
    return {success:true,data:{partNumber:part.partNumber,etag:part.etag}};
  } catch { return {success:false,error:"Multipart part upload failed."}; }
}

export async function completeMultipartUpload(
  env: StorageEnv, mediaId:number, dbUploadId:number, r2UploadId:string, parts:MultipartPartInput[]
): Promise<ServiceResult<{mediaId:number;storageKey:string}>> {
  if (!env.MEDIA_R2) return {success:false,error:"R2 media storage is not configured."};
  if (!Array.isArray(parts) || parts.length < 1 || parts.length > 10000) return {success:false,error:"Provide between 1 and 10000 uploaded parts."};
  const normalized = parts.map(p => ({partNumber:Number(p.partNumber),etag:String(p.etag)}));
  if (normalized.some(p => !validPart(p.partNumber) || !p.etag || p.etag.length > 200)) return {success:false,error:"Invalid multipart part list."};
  const nums = normalized.map(p=>p.partNumber);
  if (new Set(nums).size !== nums.length || nums.some((n,i)=>i>0 && n <= nums[i-1])) return {success:false,error:"Multipart parts must be unique and ordered."};
  const session = await getSession(env, mediaId, dbUploadId, r2UploadId);
  if (!session || session.status !== "initiated") return {success:false,error:"Multipart upload session is unavailable."};
  const mpu = env.MEDIA_R2.resumeMultipartUpload(session.storage_key, session.r2_upload_id);
  try {
    await mpu.complete(normalized.map(p => ({ partNumber:p.partNumber, etag:p.etag })));
    await env.DB.prepare("UPDATE media_multipart_uploads SET status='completed', completed_at=datetime('now') WHERE upload_id=?").bind(dbUploadId).run();
    const stored = await registerStoredMedia(env, mediaId, session.storage_key, "MEDIA_R2");
    if (!stored) {
      try { await env.MEDIA_R2.delete(session.storage_key); } catch {}
      return {success:false,error:"Media metadata could not be finalized."};
    }
    return {success:true,data:{mediaId,storageKey:session.storage_key}};
  } catch { return {success:false,error:"Multipart completion failed."}; }
}

export async function abortMultipartUpload(env:StorageEnv, mediaId:number, dbUploadId:number, r2UploadId:string):Promise<ServiceResult> {
  if (!env.MEDIA_R2) return {success:false,error:"R2 media storage is not configured."};
  const session=await getSession(env,mediaId,dbUploadId,r2UploadId);
  if(!session || session.status !== "initiated") return {success:false,error:"Multipart upload session is unavailable."};
  try { await env.MEDIA_R2.resumeMultipartUpload(session.storage_key,session.r2_upload_id).abort(); }
  catch { return {success:false,error:"Multipart abort failed; retry later."}; }
  await env.DB.prepare("UPDATE media_multipart_uploads SET status='aborted', aborted_at=datetime('now') WHERE upload_id=?").bind(dbUploadId).run();
  return {success:true};
}

export async function abortStaleMultipartUploads(env:StorageEnv, maxAgeHours=24):Promise<number>{
  if(!env.MEDIA_R2)return 0;
  const rows=await env.DB.prepare(`SELECT upload_id,media_id,r2_upload_id,storage_key FROM media_multipart_uploads WHERE status='initiated' AND datetime(created_at) <= datetime('now', ? || ' hours') LIMIT 50`).bind(String(-Math.abs(maxAgeHours))).all<any>();
  let count=0;
  for(const row of rows.results){
    try{await env.MEDIA_R2.resumeMultipartUpload(row.storage_key,row.r2_upload_id).abort();}catch{continue;}
    await env.DB.prepare("UPDATE media_multipart_uploads SET status='aborted',aborted_at=datetime('now') WHERE upload_id=? AND status='initiated'").bind(row.upload_id).run();
    count++;
  }
  return count;
}
