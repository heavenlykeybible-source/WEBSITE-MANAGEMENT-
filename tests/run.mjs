import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const target = new URL('./worker-test.mjs', import.meta.url);
fs.writeFileSync(target, fs.readFileSync('control-room-worker.js', 'utf8') + '\nexport {body,readLimited,login,ownerApi,minRole,route,UI,ghReadFile,ghFiles,corePutFile,seal,remoteListPage,remoteGet,remoteSave,remoteInput,coreProposeRemote,exportRemotePost,googleCallback,hmac,secret,protectSourcePath,protectWorker,withOperationLock,coreProposeFiles,coreFinalize,reviewSnapshot,stageProposal,releaseRoutes,ghInput,coreProposeGithub,validateNewPassword,getUser,maintenanceRun,maintenanceRoutes,aiPost,aiChat,aiResolve,aiProviders,cloudflareLoop,CF_AI_MODEL,putChatAttachment,chatAttachment,attachmentRoutes,readChatAttachment,proposeAttachmentDelivery,imageBytesValid,bytesBase64,ghCommit};');
try { await import('./security.mjs'); await import('./database.mjs'); await import('./remote.mjs'); await import('./releases.mjs'); await import('./dashboard.mjs'); await import('./accounts.mjs'); await import('./maintenance.mjs'); await import('./ai.mjs'); await import('./cloudflare-ai.mjs'); await import('./attachments.mjs'); await import('./connectivity.mjs'); }
finally { fs.unlinkSync(target); }
