# Ministry production studio

Open `/pages/admin#broadcast` and sign in as a ministry administrator. The studio publishes the programme canvas and mixed audio through the existing LiveKit project. Local preview never starts a broadcast.

## Programme controls

Prepare preview, select camera/screen/media/starting/break/ending, then Take preview to programme. Scene changes update the same broadcast output. Intermission scenes mute the microphone by default. Add ministry branding, presenter text, scripture and a scrolling ticker. Choose landscape, portrait or low data 480p output before preparing capture. Live 480p uses a 650 kbps video target; larger formats use higher targets. Browser processing and upstream network still determine delivery quality.

The mixer includes microphone, source media, screen audio when the browser provides it, and a separate looping music bed. Music defaults to 20% and automatically ducks while the microphone receives speech. Headphones prevent speaker feedback. Permission prompts and screen/system audio availability depend on the browser and device.

Go live takes priority over the 24/7 programme for the selected destination. End broadcast releases that takeover. Return to automatic 24/7 stops the current takeover and enables both channel playlists; active scheduled programmes still take priority over the playlist. Prepare manual live broadcast scrolls to the studio and prepares local capture; the administrator must explicitly click Go live.

## Media library and playback

Choose audio or video up to 2 GiB (labelled 2 GB in the interface). Uploads use 8 MiB R2 multipart chunks, progress, retries and pause/resume. After interruption, select the same original file and resume within 24 hours using the same administrator and browser. Clear browser storage or a changed file can prevent automatic resume. Uploads remain private until explicitly published or selected for an active programme. Unfinished expired uploads are aborted by the cleanup cron.

MP4 H.264/AAC and MP3 offer broad browser support. Files must contain usable audio; uploading does not synthesize missing sound or transcode incompatible codecs. Preview before publishing. The public player has Play with sound, reconnect, buffering and format error messages. It requests media only when playback starts and supports byte ranges. Radio prefers audio files and can use video audio when no audio playlist is published. Playing video through an audio element still transfers the video container; it is not an audio transcode. Recorded quality remains the uploaded quality.

Website page addresses cannot be entered as live media sources. Existing invalid ministry page sources fall back to scheduled/published media. Direct provider playback URLs still require a browser-supported media format. YouTube watch, short, embed and live links are recognized and use a visible YouTube iframe after the visitor presses Play with sound. YouTube sources remain video players on the radio page and follow YouTube embed availability and sound controls.

## Recording and privacy

Recording captures programme output with mixed audio into bounded local clips. Download each clip or explicitly save it to the private library. Recording stops at six retained clips to bound memory; it never silently deletes unsaved clips. Clear clips already saved to the library to reclaim browser memory. Permanent retention is opt-in; otherwise uploaded media expire after 48 hours.

Saved studio presets are private to each administrator and contain settings/text only. Camera tracks, API secrets and local media files are not stored in presets. Logout stops capture and revokes local clip URLs.

## Verification limits

Automated integration checks cover permissions, routing, upload resume/size limits and media byte ranges. They do not establish end-to-end camera or microphone transmission on a user's device. Keep the studio tab foregrounded for consistent browser rendering. Social multistream publishing, guest call-ins, virtual backgrounds and adaptive recorded-media transcoding are not implemented by this upgrade.
