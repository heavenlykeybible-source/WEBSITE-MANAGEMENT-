export interface Env {
  AI?: {run(model:string, args:{messages:{role:string;content:string}[];max_tokens:number;temperature:number}):Promise<{response?:string}>};
  DB: D1Database;
  SESSIONS: KVNamespace;
  MEDIA: R2Bucket;
  PASSWORD_PEPPER: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  FACEBOOK_APP_ID?: string;
  FACEBOOK_APP_SECRET?: string;
  SESSION_SECRET?: string;
  INTERSERVICE_SECRET?: string;
  PUBLIC_ORIGIN?: string;
  PLATFORM_NAME?: string;
  CALL_TURN_URLS?: string;
  CALL_TURN_SECRET?: string;
}

export type Role = "member"|"moderator"|"administrator"|"owner";
export type ModerationDecision = "allow"|"warn"|"hold"|"block";
export interface SessionUser { userId:number; role:Role; status:string; }
export interface ModerationResult {
  decision: ModerationDecision;
  category: string;
  reasons: string[];
  safeExcerpt: string;
}
