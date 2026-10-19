import {handleGRDPCPublic,handleGRDPCAdmin} from "./routes/grdpc";
import {handleWebsiteAiInbox,handleWebsiteAiConversation} from "./routes/website-ai-inbox";
import {runReminders} from "./services/grdpc-service";
import {handleCommunityPlayer} from "./routes/community-player";
/**
 * Worker entry point. Per Implementation Handbook §3: routes requests only —
 * no business logic lives here.
 */
import { handleGroupAdmin } from "./routes/group-admin";
import { handleRegister, handleLogin, handleLogout, handleProfile, handleChangePassword } from "./routes/auth";
import {
  handleCreatePrayer, handleListPrayers, handleListPrayerAudio, handlePrayerRespond,
  handleSubmitTestimony, handleListTestimonies,
  handleAskQuestion, handleGetQuestion, handleSubmitAnswer,
  handleCreateDiscussion, handleListDiscussions,
  handleAddComment, handleListComments, handleToggleReaction,
  handleFollow, handleUnfollow, handleBlock,
  handleApproveTestimony, handleFeatureTestimony, handleMarkRecommendedAnswer, handleCountReactions,
} from "./routes/community";
import {
  handleGetChapter, handleAddBookmark, handleListBookmarks, handleAddHighlight, handleAddNote,
  handleListHymns, handleGetHymn, handleToggleFavouriteHymn,
  handleTodaysVerse, handleTodaysDevotional, handleKingdomKeys, handleFaithChallenge, handleFaithChallengeRespond,
} from "./routes/spiritual-resources";
import { handleSubmitDecision, handleGetFeaturedNation, handleListNations, handleSubmitCounselling, handleViewDecisionContact, handleViewCounsellingMessage } from "./routes/evangelism";
import {
  handleCreateGroup, handleListGroups, handleJoinGroup, handleCreateGroupPost,
  handleCreatePoll, handleVotePoll, handlePollResults, handleApproveJoinRequest, handleListGroupPosts,
} from "./routes/groups";
import {
  handleIssueModerationAction, handleAddModeratorNote, handleSubmitAppeal,
  handleDecideAppeal, handleModerationDashboard, handleCommunityHealthDashboard,
} from "./routes/administration";
import {
  handleListLearningPaths, handleGetLesson, handleSubmitQuiz, handleUpdateProgress,
  handleMyGrowthDashboard, handleMinistryDiscipleshipAnalytics,
} from "./routes/discipleship";
import { handleUpdateReadingProgress, handleRecordHymnPlayed, handleListAudioBible, handleAttachAudioBible, handleAttachHymnMedia, handleWebsiteVerseOfDay, handleWebsiteMemoryVerse, handleWebsiteDevotional } from "./routes/spiritual-resources";
import { handleRegisterMedia, handleListPublicMedia, handleApproveMedia, handleGetMediaObject } from "./routes/media";
import { handleListChannels, handleCreateCampaign, handleApproveCampaign, handleGetLiveStatus, handleSetLiveStatus, handleLiveHeartbeat, handleGetLiveFallback, handleSwitchLiveToPrerecorded, handleSwitchPrerecordedToLive, handleStopLiveBroadcast, handleMediaEngineStatus, handleBroadcastStudioCapabilities } from "./routes/broadcast";
import { handleGenerateCampaignItems, handleGetCalendar, handlePauseItem, handleResumeItem, handleCancelItem } from "./routes/campaign-manager";
import { handleGetTimeline, handleCareDashboard, handleStartWorkflow, handleGetDistributionStatus, handleMyTasks } from "./routes/mrm";
import { handleCreateMinistryTask, handleGetPlatformCapability, handleListStaleCapabilities } from "./routes/mrm";
import {
  handleConnectAccount, handleListAutomatableAccounts, handleListManualOnlyAccounts,
  handleGenerateManualTasks, handleCompleteManualTask, handleCreateHashtagCollection, handleGetHashtagCollection,
} from "./routes/social-accounts";
import type { Env } from "./services/auth-service";
import { handleHomepageUpdates, handleLivesTransformedStats, handleWebsiteEvents } from "./routes/homepage";
import { handlePublicSiteContent, handleAdminSiteContent, handlePublicPageContent, handleAdminPageContent } from "./routes/site-content";
import { handleCmsPage, handleCmsPublicPage, handleCmsSlider, handleCmsSliderHistory, handleCmsAssets, handleCmsImage, handleCmsLayout } from "./routes/site-cms";
import { handleSystemUpdateStatus, handleSystemUpdateAction, handleSystemUpdateHistory } from "./routes/system-updates";
import { handlePublicSubmission, handleListPublicSubmissions } from "./routes/public-site";
import { handleUploadMedia, handleSetMediaKeep, handleDeleteMedia, handleCleanup } from "./routes/storage";
import { cleanupExpiredStorage } from "./services/storage-retention-service";
import { handleSchedulePlayout, handleListPlayout } from "./routes/playout";
import { advancePlayoutState } from "./services/playout-service";
import { monitorLiveBroadcasts } from "./services/broadcast-service";
import { handleRegisterRecording, handleSetRecordingKeep, handleDeleteRecording, handleDownloadRecording } from "./routes/recordings";

import { handleCommunityCategories, handlePendingTestimonies, handleAdminMedia, handleBroadcastProgramme, handleBroadcastObject, handleBroadcastLiveKitViewerToken } from "./routes/portal";
import { handleAdminUsers, handleAdminUserRole } from "./routes/account-admin";
import { handleWhatsAppWebhook, handleWhatsAppConnection, handleWhatsAppConversations, handleWhatsAppConversation, handleWhatsAppContact, handleWhatsAppNumbers, handleMinistryRequests, handleMinistryPrograms, handleMinistryContacts, handleWhatsAppDirectAccess, handleMinistryFollowups, handleMinistryActivity, handleMinistrySettings, handleMinistryRequestStatus, handleMinistryDashboard, handleWhatsAppNotifications, handleWhatsAppNotificationAction, handleSocialSetup, handleSocialProviderApps, handleSocialConnectionStart, handleSocialConnectionCallback, handleSocialConnectionSelection, handleSocialAccounts, handleSocialLiveAuthorization, handleSocialLiveVerification, handleSocialPublish, handleSocialJobs, handleSocialJobAction, handleSignedSocialMedia } from "./routes/communications";
import { runDueJobs } from "./services/social-management-service";

export default {
  async scheduled(controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    // Independent tasks start together: an unavailable broadcast monitor must
    // never postpone the social scheduler. Preserve monitor->playout ordering.
    const cronTasks: Array<readonly [string,()=>Promise<unknown>]> = [
      ["broadcast monitor + playout", async()=>{await monitorLiveBroadcasts(env);await advancePlayoutState(env);}],
      ["social scheduler", ()=>runDueJobs(env)],
      ["reminders", ()=>runReminders(env,controller.scheduledTime)]
    ];
    if(new Date(controller.scheduledTime).getUTCMinutes()%15===0)
      cronTasks.push(["storage cleanup",()=>cleanupExpiredStorage(env)]);
    await Promise.all(cronTasks.map(async([name,run])=>{
      try{await run();}catch(error){console.error("Scheduled "+name+" failed:",error instanceof Error?error.message:"unknown");}
    }));
  },
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;
    const idMatch = (pattern: RegExp) => pathname.match(pattern);

    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "https://www.heavenlykey.org",
          "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin",
        },
      });
    }

    if(pathname.startsWith('/api/')&&request.headers.get('Content-Type')?.includes('application/json')&&!['GET','HEAD','OPTIONS'].includes(method)){
      try{const body=await request.clone().json();if(!body||Array.isArray(body)||typeof body!=='object')throw new Error();}
      catch{return Response.json({error:{message:'Send a valid JSON object.'}},{status:400});}
    }
    if(pathname.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(method)){
      const origin=request.headers.get('Origin');if(origin&&origin!==url.origin)return Response.json({error:{message:'Use the website to perform this action.'}},{status:403});
    }
    if (pathname === "/api/broadcast/community-player" && method === "GET") return handleCommunityPlayer(request);
    if (pathname === "/api/homepage-updates" && method === "GET") return handleHomepageUpdates(request, env);
    if (pathname === "/api/site-content/homepage" && method === "GET") return handlePublicSiteContent(request, env);
    if (pathname === "/api/admin/site-content/homepage" && ["GET","POST"].includes(method)) return handleAdminSiteContent(request, env);
    if (pathname === "/api/site-content/page" && method === "GET") return handlePublicPageContent(request, env);
    if (pathname === "/api/admin/site-content/page" && ["GET","POST"].includes(method)) return handleAdminPageContent(request, env);
    // Visual site builder: normal website Administrator login, not Account 4 credentials.
    if (pathname === "/api/admin/cms/page" && ["GET","POST"].includes(method)) return handleCmsPage(request, env);
    if (pathname === "/api/site-content/cms" && method === "GET") return handleCmsPublicPage(request, env);
    if (pathname === "/api/admin/cms/slider" && ["GET","POST"].includes(method)) return handleCmsSlider(request, env, true);
    if (pathname === "/api/admin/cms/slider/history" && method === "GET") return handleCmsSliderHistory(request, env);
    if (pathname === "/api/site-content/slider" && method === "GET") return handleCmsSlider(request, env, false);
    if (pathname === "/api/site-content/layout" && method === "GET") return handleCmsLayout(request, env, false);
    if (pathname === "/api/admin/cms/layout" && ["GET","POST"].includes(method)) return handleCmsLayout(request, env, true);
    if (pathname === "/api/admin/cms/assets" && ["GET","POST"].includes(method)) return handleCmsAssets(request, env);
    { const m = idMatch(/^\/api\/site-content\/assets\/([0-9a-f-]{36})$/); if (m && ["GET","HEAD"].includes(method)) return handleCmsImage(request, env, m[1]); }

    if (pathname === "/api/admin/system-updates" && method === "GET") return handleSystemUpdateStatus(request, env);
    if (pathname === "/api/admin/system-updates/history" && method === "GET") return handleSystemUpdateHistory(request, env);
    if (pathname === "/api/admin/system-updates/action" && method === "POST") return handleSystemUpdateAction(request, env);
    if (pathname === "/api/stats/lives-transformed" && method === "GET") return handleLivesTransformedStats(request, env);
    if (pathname === "/api/events" && method === "GET") return handleWebsiteEvents(request, env);
    if (pathname === "/api/contact" && method === "POST") return handlePublicSubmission(request, env as any, "contact");
    if (pathname === "/api/newsletter" && method === "POST") return handlePublicSubmission(request, env as any, "newsletter");
    if (pathname === "/api/partner" && method === "POST") return handlePublicSubmission(request, env as any, "partner");
    if (pathname === "/api/public/prayer" && method === "POST") return handlePublicSubmission(request, env as any, "prayer");
    if (pathname === "/api/public/testimony" && method === "POST") return handlePublicSubmission(request, env as any, "testimony");
    if (pathname === "/api/admin/public-submissions" && method === "GET") return handleListPublicSubmissions(request, env as any);

    if (pathname === "/api/grdpc" && method === "GET") return handleGRDPCPublic(request,env);
    if (pathname === "/api/admin/grdpc" && ["GET","POST"].includes(method)) return handleGRDPCAdmin(request,env);
    // Website AI inbox is separate from actual WhatsApp conversations.
    if(pathname==="/api/admin/website-ai/conversations"&&["GET","DELETE"].includes(method))return handleWebsiteAiInbox(request,env);
    {const m=idMatch(/^\/api\/admin\/website-ai\/conversations\/([a-zA-Z0-9_-]{8,100})$/);if(m&&["GET","PATCH"].includes(method))return handleWebsiteAiConversation(request,env,m[1]);}
    // ---------- WhatsApp + Social Management ----------
    if (pathname === "/api/integrations/whatsapp/webhook" && ["GET","POST"].includes(method)) return handleWhatsAppWebhook(request,env);
    if (pathname === "/api/admin/whatsapp/connection" && ["GET","POST"].includes(method)) return handleWhatsAppConnection(request,env);
    if (pathname === "/api/admin/whatsapp/numbers" && ["GET","POST"].includes(method)) return handleWhatsAppNumbers(request,env);
    {const m=idMatch(/^\/api\/admin\/whatsapp\/numbers\/(\d+)$/);if(m&&method==="POST")return handleWhatsAppNumbers(request,env,Number(m[1]));}
    if (pathname === "/api/admin/ministry/prayer-requests" && method === "GET") return handleMinistryRequests(request,env,"prayer");
    if (pathname === "/api/admin/ministry/partnership-requests" && method === "GET") return handleMinistryRequests(request,env,"partnership");
    if (pathname === "/api/admin/ministry/evangelist-requests" && method === "GET") return handleMinistryRequests(request,env,"evangelist");
    if (pathname === "/api/admin/ministry/programs" && ["GET","POST"].includes(method)) return handleMinistryPrograms(request,env);
    if (pathname === "/api/admin/ministry/dashboard" && method === "GET") return handleMinistryDashboard(request,env);
    if (pathname === "/api/admin/ministry/contacts" && method === "GET") return handleMinistryContacts(request,env);
    if (pathname === "/api/admin/whatsapp/direct-access" && method === "POST") return handleWhatsAppDirectAccess(request,env);
    if (pathname === "/api/admin/ministry/followups" && ["GET","POST"].includes(method)) return handleMinistryFollowups(request,env);
    {const m=idMatch(/^\/api\/admin\/ministry\/followups\/(\d+)$/);if(m&&method==="POST")return handleMinistryFollowups(request,env,Number(m[1]));}
    if (pathname === "/api/admin/ministry/activity" && method === "GET") return handleMinistryActivity(request,env);
    if (pathname === "/api/admin/ministry/settings" && ["GET","POST"].includes(method)) return handleMinistrySettings(request,env);
    {const m=idMatch(/^\/api\/admin\/ministry\/(prayer|partnership|evangelist)-requests\/(\d+)\/status$/);if(m&&method==="POST")return handleMinistryRequestStatus(request,env,m[1] as any,Number(m[2]));}

    if (pathname === "/api/admin/whatsapp/conversations" && method === "GET") return handleWhatsAppConversations(request,env);
    {const m=idMatch(/^\/api\/admin\/whatsapp\/conversations\/(\d+)(?:\/(reply|resolve|assign))?$/);if(m&&((!m[2]&&method==="GET")||(m[2]&&method==="POST")))return handleWhatsAppConversation(request,env,Number(m[1]),m[2]);}
    {const m=idMatch(/^\/api\/admin\/whatsapp\/contacts\/(\d+)\/access$/);if(m&&method==="POST")return handleWhatsAppContact(request,env,Number(m[1]));}
    if (pathname === "/api/admin/whatsapp/notifications" && method === "GET") return handleWhatsAppNotifications(request,env);
    {const m=idMatch(/^\/api\/admin\/whatsapp\/notifications\/(\d+)$/);if(m&&method==="POST")return handleWhatsAppNotificationAction(request,env,Number(m[1]));}

    if (pathname === "/api/admin/social/setup-status" && method === "GET") return handleSocialSetup(request,env);
    if (pathname === "/api/admin/social/provider-apps" && ["GET","POST"].includes(method)) return handleSocialProviderApps(request,env);
    if (pathname === "/api/admin/social/connections/start" && method === "GET") return handleSocialConnectionStart(request,env);
    if (pathname === "/api/social/connections/callback" && method === "GET") return handleSocialConnectionCallback(request,env);
    if (pathname === "/api/admin/social/connections/selection" && ["GET","POST"].includes(method)) return handleSocialConnectionSelection(request,env);
    if (pathname === "/api/admin/social/accounts" && method === "GET") return handleSocialAccounts(request,env);
    {const m=idMatch(/^\/api\/admin\/social\/accounts\/([^/]+)\/(state|remove)$/);if(m&&method==="POST")return handleSocialAccounts(request,env,decodeURIComponent(m[1]),m[2]);}
    if (pathname === "/api/admin/social/live-authorization" && ["GET","POST"].includes(method)) return handleSocialLiveAuthorization(request,env);
    if (pathname === "/api/admin/social/live-verification" && method === "POST") return handleSocialLiveVerification(request,env);
    if (pathname === "/api/admin/social/publish" && method === "POST") return handleSocialPublish(request,env);
    if (pathname === "/api/admin/social/jobs" && method === "GET") return handleSocialJobs(request,env);
    {const m=idMatch(/^\/api\/admin\/social\/jobs\/(\d+)\/(retry|cancel)$/);if(m&&method==="POST")return handleSocialJobAction(request,env,Number(m[1]),m[2]);}
    {const m=idMatch(/^\/api\/social-media\/(\d+)\/object$/);if(m&&["GET","HEAD"].includes(method))return handleSignedSocialMedia(request,env,Number(m[1]));}

    if(pathname==='/api/admin/groups' && method==='GET')return handleGroupAdmin(request,env);
    {const m=idMatch(/^\/api\/admin\/groups\/(\d+)$/);if(m&&['GET','POST'].includes(method))return handleGroupAdmin(request,env,Number(m[1]));}
    const dashboardMediaRoutes: Record<string,string> = {
      '/api/admin/media-engine/studio/preferences':'/api/media-engine/studio/preferences',
      '/api/admin/media-engine/livekit/connection':'/api/media-engine/livekit/connection',
      '/api/admin/media-engine/capabilities':'/api/media-engine/studio/capabilities',
      '/api/admin/media-engine/social-accounts':'/api/social/accounts',
      '/api/admin/media-engine/distribution-jobs':'/api/distribution/jobs',
      '/api/admin/media-engine/restream':'/api/media-engine/restream',
      '/api/admin/media-engine/restream/destination':'/api/media-engine/restream/destination',
      '/api/admin/media-engine/restream/start':'/api/media-engine/restream/start',
      '/api/admin/media-engine/restream/stop':'/api/media-engine/restream/stop',
      '/api/admin/media-engine/campaigns':'/api/campaigns',
      '/api/admin/media-engine/livekit/publisher-token':'/api/media-engine/livekit/publisher-token'
    };
    if(dashboardMediaRoutes[pathname] && (method==='GET' || (['/api/admin/media-engine/studio/preferences','/api/admin/media-engine/campaigns','/api/admin/media-engine/livekit/publisher-token','/api/admin/media-engine/livekit/connection','/api/admin/media-engine/restream/destination','/api/admin/media-engine/restream/start','/api/admin/media-engine/restream/stop'].includes(pathname) && method==='POST')))return handleAdminMedia(request,env,dashboardMediaRoutes[pathname]);
    {const m=idMatch(/^\/api\/admin\/media-engine\/campaigns\/(\d+)\/cancel$/);if(m&&method==='POST')return handleAdminMedia(request,env,`/api/campaigns/${m[1]}/cancel`);}
    if(pathname==='/api/admin/media-engine/broadcast-settings' && ['GET','POST'].includes(method))return handleAdminMedia(request,env,'/api/broadcast/settings');
    if(pathname==='/api/admin/media-engine/playlist-order' && ['GET','POST'].includes(method))return handleAdminMedia(request,env,'/api/broadcast/playlist-order');
    {const m=idMatch(/^\/api\/admin\/media-engine\/playout\/(\d+)\/cancel$/);if(m&&method==='POST')return handleAdminMedia(request,env,`/api/playout/${m[1]}/cancel`);}
    if (pathname === "/api/community/categories" && method === "GET") return handleCommunityCategories(request,env);
    if (pathname === "/api/admin/testimonies/pending" && method === "GET") return handlePendingTestimonies(request,env);
    {const m=idMatch(/^\/api\/admin\/media-engine\/media\/(\d+)\/preview$/);if(m&&['GET','HEAD'].includes(method))return handleAdminMedia(request,env,`/api/media/${m[1]}/preview`);}
    {const m=pathname.match(/^\/api\/admin\/media-engine\/media\/(\d+)\/multipart(?:\/(status|complete|abort|part\/\d+))?$/);if(m&&['GET','POST','PUT'].includes(method))return handleAdminMedia(request,env,pathname.replace('/api/admin/media-engine','/api'));}
    if (pathname === "/api/admin/media-engine/media" && ["GET","POST"].includes(method)) return handleAdminMedia(request,env,"/api/media");
    { const m=idMatch(/^\/api\/admin\/media-engine\/media\/(\d+)\/(upload|publish|keep|delete)$/); if(m && ((m[2]==="upload" && method==="PUT") || (m[2]!=="upload" && method==="POST"))) return handleAdminMedia(request,env,`/api/media/${m[1]}/${m[2]}`); }
    if (pathname === "/api/broadcast/programme" && method === "GET") return handleBroadcastProgramme(request,env);
    if (pathname === "/api/broadcast/livekit/viewer-token" && method === "POST") return handleBroadcastLiveKitViewerToken(request,env);
    { const m=idMatch(/^\/api\/broadcast\/media\/(\d+)\/object$/); if(m && ["GET","HEAD"].includes(method)) return handleBroadcastObject(request,env,Number(m[1])); }

    if (pathname === "/api/auth/register" && method === "POST") return handleRegister(request, env);
    if (pathname === "/api/auth/login" && method === "POST") return handleLogin(request, env);
    if (pathname === "/api/auth/logout" && method === "POST") return handleLogout(request, env);
    if (pathname === "/api/auth/profile" && method === "GET") return handleProfile(request, env);
    if (pathname === "/api/auth/change-password" && method === "POST") return handleChangePassword(request, env);
    if (pathname === "/api/admin/users" && method === "GET") return handleAdminUsers(request, env);
    { const m=idMatch(/^\/api\/admin\/users\/(\d+)\/role$/); if(m&&method==="POST") return handleAdminUserRole(request,env,Number(m[1])); }

    // ---------- Module 2: Community ----------
    if (pathname === "/api/prayer" && method === "POST") return handleCreatePrayer(request, env);
    if (pathname === "/api/prayer" && method === "GET") return handleListPrayers(request, env);
    { const m = idMatch(/^\/api\/prayer\/(\d+)\/respond$/); if (m && method === "POST") return handlePrayerRespond(request, env, Number(m[1])); }

    if (pathname === "/api/testimonies" && method === "POST") return handleSubmitTestimony(request, env);
    if (pathname === "/api/testimonies" && method === "GET") return handleListTestimonies(request, env);
    { const m = idMatch(/^\/api\/testimonies\/(\d+)\/approve$/); if (m && method === "POST") return handleApproveTestimony(request, env, Number(m[1])); }
    { const m = idMatch(/^\/api\/testimonies\/(\d+)\/feature$/); if (m && method === "POST") return handleFeatureTestimony(request, env, Number(m[1])); }

    if (pathname === "/api/questions" && method === "POST") return handleAskQuestion(request, env);
    { const m = idMatch(/^\/api\/questions\/(\d+)$/); if (m && method === "GET") return handleGetQuestion(request, env, Number(m[1])); }
    { const m = idMatch(/^\/api\/questions\/(\d+)\/answers$/); if (m && method === "POST") return handleSubmitAnswer(request, env, Number(m[1])); }
    { const m = idMatch(/^\/api\/answers\/(\d+)\/recommend$/); if (m && method === "POST") return handleMarkRecommendedAnswer(request, env, Number(m[1])); }

    if (pathname === "/api/discussions" && method === "POST") return handleCreateDiscussion(request, env);
    if (pathname === "/api/discussions" && method === "GET") return handleListDiscussions(request, env);

    if (pathname === "/api/comments" && method === "POST") return handleAddComment(request, env);
    if (pathname === "/api/comments" && method === "GET") return handleListComments(request, env);
    if (pathname === "/api/reactions" && method === "POST") return handleToggleReaction(request, env);

    { const m = idMatch(/^\/api\/follow\/(\d+)$/); if (m && method === "POST") return handleFollow(request, env, Number(m[1])); }
    { const m = idMatch(/^\/api\/follow\/(\d+)$/); if (m && method === "DELETE") return handleUnfollow(request, env, Number(m[1])); }
    { const m = idMatch(/^\/api\/block\/(\d+)$/); if (m && method === "POST") return handleBlock(request, env, Number(m[1])); }

    // ---------- Module 3: Spiritual Resources ----------
    { const m = idMatch(/^\/api\/bible\/([^/]+)\/(\d+)$/); if (m && method === "GET") return handleGetChapter(request, env, decodeURIComponent(m[1]), Number(m[2])); }
    if (pathname === "/api/bible/bookmarks" && method === "POST") return handleAddBookmark(request, env);
    if (pathname === "/api/bible/bookmarks" && method === "GET") return handleListBookmarks(request, env);
    if (pathname === "/api/bible/highlights" && method === "POST") return handleAddHighlight(request, env);
    if (pathname === "/api/bible/notes" && method === "POST") return handleAddNote(request, env);

    if (pathname === "/api/hymns" && method === "GET") return handleListHymns(request, env);
    if (pathname === "/api/bible/audio" && method === "GET") return handleListAudioBible(request, env);
    if (pathname === "/api/admin/bible/audio" && method === "POST") return handleAttachAudioBible(request, env);
    { const m = idMatch(/^\/api\/hymns\/(\d+)$/); if (m && method === "GET") return handleGetHymn(request, env, Number(m[1])); }
    { const m = idMatch(/^\/api\/hymns\/(\d+)\/favourite$/); if (m && method === "POST") return handleToggleFavouriteHymn(request, env, Number(m[1])); }
    { const m = idMatch(/^\/api\/admin\/hymns\/(\d+)\/media$/); if (m && method === "POST") return handleAttachHymnMedia(request, env, Number(m[1])); }

    if (pathname === "/api/devotionals/verse-of-day" && method === "GET") return handleTodaysVerse(request, env);
    if (pathname === "/api/bible/verse-of-day" && method === "GET") return handleWebsiteVerseOfDay(request, env);
    if (pathname === "/api/bible/memory-verse" && method === "GET") return handleWebsiteMemoryVerse(request, env);
    if (pathname === "/api/devotionals/today" && method === "GET") return handleTodaysDevotional(request, env);
    if (pathname === "/api/devotionals" && method === "GET") return handleWebsiteDevotional(request, env);
    if (pathname === "/api/kingdom-keys/current" && method === "GET") return handleKingdomKeys(request, env);
    if (pathname === "/api/faith-challenges/current" && method === "GET") return handleFaithChallenge(request, env);
    { const m = idMatch(/^\/api\/faith-challenges\/(\d+)\/respond$/); if (m && method === "POST") return handleFaithChallengeRespond(request, env, Number(m[1])); }

    // ---------- Module 4: Evangelism ----------
    if (pathname === "/api/decisions" && method === "POST") return handleSubmitDecision(request, env as any);
    if (pathname === "/api/nations/featured" && method === "GET") return handleGetFeaturedNation(request, env as any);
    if (pathname === "/api/nations" && method === "GET") return handleListNations(request, env as any);
    if (pathname === "/api/counselling" && method === "POST") return handleSubmitCounselling(request, env as any);
    { const m = idMatch(/^\/api\/admin\/decisions\/(\d+)\/contact$/); if (m && method === "GET") return handleViewDecisionContact(request, env as any, Number(m[1])); }
    { const m = idMatch(/^\/api\/admin\/counselling\/(\d+)\/message$/); if (m && method === "GET") return handleViewCounsellingMessage(request, env as any, Number(m[1])); }

    // ---------- Module 5: Groups & Fellowship ----------
    if (pathname === "/api/groups" && method === "POST") return handleCreateGroup(request, env);
    if (pathname === "/api/groups" && method === "GET") return handleListGroups(request, env);
    { const m = idMatch(/^\/api\/groups\/(\d+)\/join$/); if (m && method === "POST") return handleJoinGroup(request, env, Number(m[1])); }
    { const m = idMatch(/^\/api\/groups\/join-requests\/(\d+)\/approve$/); if (m && method === "POST") return handleApproveJoinRequest(request, env, Number(m[1])); }
    { const m = idMatch(/^\/api\/groups\/(\d+)\/posts$/); if (m && method === "POST") return handleCreateGroupPost(request, env, Number(m[1])); }
    { const m = idMatch(/^\/api\/groups\/(\d+)\/posts$/); if (m && method === "GET") return handleListGroupPosts(request, env, Number(m[1])); }
    { const m = idMatch(/^\/api\/groups\/(\d+)\/polls$/); if (m && method === "POST") return handleCreatePoll(request, env, Number(m[1])); }
    { const m = idMatch(/^\/api\/polls\/(\d+)\/vote$/); if (m && method === "POST") return handleVotePoll(request, env, Number(m[1])); }
    { const m = idMatch(/^\/api\/polls\/(\d+)\/results$/); if (m && method === "GET") return handlePollResults(request, env, Number(m[1])); }

    // ---------- Module 6: Community Administration ----------
    if (pathname === "/api/admin/moderation-actions" && method === "POST") return handleIssueModerationAction(request, env);
    if (pathname === "/api/admin/moderator-notes" && method === "POST") return handleAddModeratorNote(request, env);
    if (pathname === "/api/appeals" && method === "POST") return handleSubmitAppeal(request, env);
    if (pathname === "/api/admin/appeals/decide" && method === "POST") return handleDecideAppeal(request, env);
    if (pathname === "/api/admin/dashboard/moderation" && method === "GET") return handleModerationDashboard(request, env);
    if (pathname === "/api/admin/dashboard/community-health" && method === "GET") return handleCommunityHealthDashboard(request, env);

    // ---------- Ministry Management Suite: Discipleship Centre (ACR-007-009) ----------
    if (pathname === "/api/discipleship/paths" && method === "GET") return handleListLearningPaths(request, env);
    { const m = idMatch(/^\/api\/discipleship\/lessons\/(\d+)$/); if (m && method === "GET") return handleGetLesson(request, env, Number(m[1])); }
    { const m = idMatch(/^\/api\/discipleship\/lessons\/(\d+)\/quiz$/); if (m && method === "POST") return handleSubmitQuiz(request, env, Number(m[1])); }
    { const m = idMatch(/^\/api\/discipleship\/lessons\/(\d+)\/progress$/); if (m && method === "POST") return handleUpdateProgress(request, env, Number(m[1])); }
    if (pathname === "/api/discipleship/my-growth" && method === "GET") return handleMyGrowthDashboard(request, env);
    if (pathname === "/api/discipleship/analytics" && method === "GET") return handleMinistryDiscipleshipAnalytics(request, env);

    // ---------- Ministry Management Suite: Media Management (ACR-010) ----------
    if (pathname === "/api/media" && method === "POST") return handleRegisterMedia(request, env);
    if (pathname === "/api/media" && method === "GET") return handleListPublicMedia(request, env);
    { const m = idMatch(/^\/api\/media\/(\d+)\/object$/); if (m && method === "GET") return handleGetMediaObject(request, env, Number(m[1])); }
    { const m = idMatch(/^\/api\/media\/(\d+)\/approve$/); if (m && method === "POST") return handleApproveMedia(request, env, Number(m[1])); }
    { const m = idMatch(/^\/api\/media\/(\d+)\/upload$/); if (m && method === "PUT") return handleUploadMedia(request, env, Number(m[1])); }
    { const m = idMatch(/^\/api\/media\/(\d+)\/keep$/); if (m && method === "POST") return handleSetMediaKeep(request, env, Number(m[1])); }
    { const m = idMatch(/^\/api\/media\/(\d+)$/); if (m && method === "DELETE") return handleDeleteMedia(request, env, Number(m[1])); }
    if (pathname === "/api/admin/storage/cleanup" && method === "POST") return handleCleanup(request, env);
    if (pathname === "/api/broadcast/playout" && method === "POST") return handleSchedulePlayout(request, env);
    if (pathname === "/api/broadcast/playout" && method === "GET") return handleListPlayout(request, env);
    if (pathname === "/api/broadcast/recordings" && method === "POST") return handleRegisterRecording(request, env);
    { const m = idMatch(/^\/api\/broadcast\/recordings\/(\d+)\/keep$/); if (m && method === "POST") return handleSetRecordingKeep(request, env, Number(m[1])); }
    { const m = idMatch(/^\/api\/broadcast\/recordings\/(\d+)$/); if (m && method === "DELETE") return handleDeleteRecording(request, env, Number(m[1])); }
    { const m = idMatch(/^\/api\/broadcast\/recordings\/(\d+)\/download$/); if (m && method === "GET") return handleDownloadRecording(request, env, Number(m[1])); }

    // ---------- Ministry Management Suite: Broadcast & Distribution (ACR-011) ----------
    if (pathname === "/api/broadcast/channels" && method === "GET") return handleListChannels(request, env as any);
    if (pathname === "/api/broadcast/campaigns" && method === "POST") return handleCreateCampaign(request, env as any);
    { const m = idMatch(/^\/api\/broadcast\/campaigns\/(\d+)\/approve$/); if (m && method === "POST") return handleApproveCampaign(request, env as any, Number(m[1])); }
    if (pathname === "/api/broadcast/live-status" && method === "GET") return handleGetLiveStatus(request, env as any);
    if (pathname === "/api/admin/media-engine/status" && method === "GET") return handleMediaEngineStatus(request, env as any);
    if (pathname === "/api/admin/broadcast/studio-capabilities" && method === "GET") return handleBroadcastStudioCapabilities(request, env as any);
    if (pathname === "/api/broadcast/live-status" && method === "POST") return handleSetLiveStatus(request, env as any);
    { const m = idMatch(/^\/api\/broadcast\/live-session\/(\d+)\/heartbeat$/); if (m && method === "POST") return handleLiveHeartbeat(request, env as any, Number(m[1])); }
    { const m = idMatch(/^\/api\/broadcast\/live-session\/(\d+)\/switch-to-prerecorded$/); if (m && method === "POST") return handleSwitchLiveToPrerecorded(request, env as any, Number(m[1])); }
    { const m = idMatch(/^\/api\/broadcast\/live-session\/(\d+)\/switch-to-live$/); if (m && method === "POST") return handleSwitchPrerecordedToLive(request, env as any, Number(m[1])); }
    { const m = idMatch(/^\/api\/broadcast\/live-session\/(\d+)\/stop$/); if (m && method === "POST") return handleStopLiveBroadcast(request, env as any, Number(m[1])); }
    { const m = idMatch(/^\/api\/broadcast\/live-session\/(\d+)\/fallback$/); if (m && method === "GET") return handleGetLiveFallback(request, env as any, Number(m[1])); }

    // ---------- Campaign Manager (ACR-012/013) ----------
    { const m = idMatch(/^\/api\/broadcast\/campaigns\/(\d+)\/items\/generate$/); if (m && method === "POST") return handleGenerateCampaignItems(request, env, Number(m[1])); }
    { const m = idMatch(/^\/api\/broadcast\/campaigns\/(\d+)\/calendar$/); if (m && method === "GET") return handleGetCalendar(request, env, Number(m[1])); }
    { const m = idMatch(/^\/api\/broadcast\/items\/(\d+)\/pause$/); if (m && method === "POST") return handlePauseItem(request, env, Number(m[1])); }
    { const m = idMatch(/^\/api\/broadcast\/items\/(\d+)\/resume$/); if (m && method === "POST") return handleResumeItem(request, env, Number(m[1])); }
    { const m = idMatch(/^\/api\/broadcast\/items\/(\d+)\/cancel$/); if (m && method === "POST") return handleCancelItem(request, env, Number(m[1])); }

    // ---------- Ministry Relationship Management (ACR-016) ----------
    { const m = idMatch(/^\/api\/mrm\/timeline\/(\d+)$/); if (m && method === "GET") return handleGetTimeline(request, env, Number(m[1])); }
    if (pathname === "/api/mrm/care-dashboard" && method === "GET") return handleCareDashboard(request, env);
    if (pathname === "/api/mrm/workflows/start" && method === "POST") return handleStartWorkflow(request, env);
    if (pathname === "/api/mrm/my-tasks" && method === "GET") return handleMyTasks(request, env);
    { const m = idMatch(/^\/api\/broadcast\/campaigns\/(\d+)\/distribution-status$/); if (m && method === "GET") return handleGetDistributionStatus(request, env, Number(m[1])); }

    if (pathname === "/api/reactions/count" && method === "GET") return handleCountReactions(request, env);

    // ---------- Remaining gap-sweep routes ----------
    if (pathname === "/api/social-accounts" && method === "POST") return handleConnectAccount(request, env as any);
    if (pathname === "/api/social-accounts/automatable" && method === "GET") return handleListAutomatableAccounts(request, env as any);
    if (pathname === "/api/social-accounts/manual-only" && method === "GET") return handleListManualOnlyAccounts(request, env as any);
    { const m = idMatch(/^\/api\/broadcast\/campaigns\/(\d+)\/generate-manual-tasks$/); if (m && method === "POST") return handleGenerateManualTasks(request, env as any, Number(m[1])); }
    { const m = idMatch(/^\/api\/manual-tasks\/(\d+)\/complete$/); if (m && method === "POST") return handleCompleteManualTask(request, env as any, Number(m[1])); }
    if (pathname === "/api/hashtag-collections" && method === "POST") return handleCreateHashtagCollection(request, env as any);
    { const m = idMatch(/^\/api\/hashtag-collections\/(\d+)$/); if (m && method === "GET") return handleGetHashtagCollection(request, env as any, Number(m[1])); }
    if (pathname === "/api/mrm/tasks" && method === "POST") return handleCreateMinistryTask(request, env as any);
    { const m = idMatch(/^\/api\/platform-capability\/([^/]+)$/); if (m && method === "GET") return handleGetPlatformCapability(request, env as any, decodeURIComponent(m[1])); }
    if (pathname === "/api/platform-capability/stale" && method === "GET") return handleListStaleCapabilities(request, env as any);
    if (pathname === "/api/bible/reading-plans/progress" && method === "POST") return handleUpdateReadingProgress(request, env);
    { const m = idMatch(/^\/api\/hymns\/(\d+)\/play$/); if (m && method === "POST") return handleRecordHymnPlayed(request, env, Number(m[1])); }

    return new Response(JSON.stringify({ error: { code: "not_found", message: "Unknown endpoint." } }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      },
    });
  },
};
