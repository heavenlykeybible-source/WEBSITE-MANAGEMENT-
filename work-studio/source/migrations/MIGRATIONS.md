# Migration Application Order

**Apply in this exact sequence to a fresh D1 instance.**

| # | File | Depends On | Adds |
|---|---|---|---|
| 1 | `0001_auth_foundation.sql` | — | users, auth, roles, permissions |
| 2 | `0002_community.sql` | 1 | categories, prayer, testimonies, questions/answers, discussions, comments, reactions, moderation_queue, follows |
| 3 | `0003_spiritual_resources.sql` | 1, 2 | bible_books/chapters/verses, audio_bible, bookmarks/highlights/notes, reading_plans, daily_spiritual_content, hymns, kingdom_keys, faith_challenges |
| 4 | `0004_spiritual_resources_addendum.sql` | 3 | expanded hymn fields, prayer_guides, bible_dictionary, bible_maps, related_content |
| 5 | `0005_evangelism.sql` | 1, 2 | nations, missions, decisions, counselling, follow_up_workers/assignments |
| 6 | `0006_encryption_idempotency.sql` | 5 | IV columns, idempotency keys, ai_response_review |
| 7 | `0007_groups.sql` | 1 | groups, group_members, group_posts, polls, minister_profiles |
| 8 | `0008_community_administration.sql` | 1, 2 | moderation_actions, moderator_notes, appeals |
| 9 | `0009_bible_training_base.sql` | 1 | **courses, lessons, course_progress — FIX: root cause of a bug found during Discipleship Centre implementation; these were in the original Core Domain Model but never created until this migration** |
| 10 | `0010_discipleship_centre.sql` | 9 | rich lesson fields, quiz tables |
| 11 | `0011_learning_paths.sql` | 10 | learning_paths, path linkage, lesson metadata |

**Rule going forward:** every new migration gets added to the bottom of this table with its dependency noted before it's applied anywhere.
| 12 | `0012_media_library.sql` | 1 | media library and publication metadata |
| 13 | `0013_broadcast_distribution.sql` | 1, 12 | broadcast channels, campaigns, delivery log, live status |
| 14 | `0014_campaign_manager.sql` | 13 | campaign items and scheduling |
| 15 | `0015_campaign_refinements.sql` | 14 | campaign scheduling refinements |
| 16 | `0016_multi_account_social.sql` | 13 | connected social accounts and manual ministry tasks |
| 17 | `0017_unified_distribution.sql` | 16 | capability registry and unified distribution metadata |
| 18 | `0018_ministry_relationship_management.sql` | 5, 16 | MRM workflows and tasks |
| 19 | `0019_audit_logs.sql` | prior migrations | audit logging |
| 20 | `0020_storage_retention.sql` | 12, 13, 14, 16 | R2 media retention, temporary recordings, playout assets, distribution jobs |
| 21 | `0021_distribution_idempotency.sql` | 20 | duplicate-job prevention and distribution/retention indexes |

| 31 | `0031_whatsapp_social_management.sql` | 1, 16, 19, 20 | integrated WhatsApp inbox, encrypted social account connections, provider publishing jobs and scheduled social delivery |

| 32 | `0032_social_provider_apps.sql` | 1, 19, 31 | encrypted dashboard-managed OAuth provider application credentials for social account authorization |

| 33 | `0033_social_connection_selection.sql` | 31, 32 | guided OAuth page/channel selection after provider authorization |

## 0035 — GRDPC reminders
Adds programme settings (sending paused by default), explicit WhatsApp subscription consent and atomic delivery claims with daily send limits. Apply before deploying the reminder worker. Existing contacts are not automatically subscribed.


| 36 | `0036_site_content.sql` | 1 | allow-listed editable public website/homepage text managed by administrators |
