# Heavenly Key Studio — agreed scope

The homepage design is temporary. Keep one central Studio home and one release channel through Account 4. Do not present planned modules as finished.

| Module | Direction | Current candidate |
| --- | --- | --- |
| Live Broadcast Studio | Camera, microphone, screen/media, branding, preview, broadcast and recording | Existing implementation refined; real device and end-to-end broadcast acceptance pending |
| AI Video & Audio Editing | Independent editing workspace, its own path and website | Planned entry and explanation only; no editing service deployed |
| Live Meetings | Interactive host/guest meetings similar to Zoom | Planned entry only; not implemented as a meeting service |
| Social Media Auto Post | Compose, publish and schedule posts to connected accounts | Planned entry only; not an installed automatic posting service |
| 24/7 Online Radio | Live microphone programmes, audio recordings and automatic playback | Existing engine and simplified workspace; live playback verification pending |
| Social Media Automation | Recurring workflows and social tasks | Planned entry only; distinct from live RTMP distribution |
| Settings | Sign-in, device test and connection checks | Local camera/microphone test and server connection diagnostics included |
| Sources / Media Library | Upload, preview, retain and publish media | Existing multipart workflow; private upload until publication/use |
| Connections | Broadcast service and streaming destinations | LiveKit + encrypted RTMP configuration; provider account readiness still needs live checking |

The temporary home follows the approved green/cream/gold sample with its own navigation, microphone/globe illustration, simple task cards and the existing ministry homepage footer. App-store availability is not claimed. The public main website opens separately.

Login has two options: existing owner control room session, or direct username/password using the same control room identity store. Existing owner/admin roles and password changes remain central. No second password database is created. Account 4 must be mapped to the actual intended live control-room Worker before installation; repository code is not evidence of that live account mapping.

All code lives in WEBSITE-MANAGEMENT-/studio. Normal Studio deployments update the same Account 2 heavenlykey-media Worker. Account 4 controls review and release; it does not need to take over media storage or the runtime.
