PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','moderator','administrator','owner')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','restricted','suspended','banned')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id INTEGER PRIMARY KEY,
  full_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  profile_photo_key TEXT,
  cover_photo_key TEXT,
  country TEXT,
  state_region TEXT,
  city TEXT,
  date_of_birth TEXT,
  birth_display_mode TEXT NOT NULL DEFAULT 'private' CHECK(birth_display_mode IN ('full','day_month','age','private')),
  bio TEXT,
  church TEXT,
  work TEXT,
  ministry_calling TEXT,
  christian_interests TEXT,
  description TEXT,
  location_visibility TEXT NOT NULL DEFAULT 'public' CHECK(location_visibility IN ('public','connections','private')),
  church_visibility TEXT NOT NULL DEFAULT 'public' CHECK(church_visibility IN ('public','connections','private')),
  work_visibility TEXT NOT NULL DEFAULT 'public' CHECK(work_visibility IN ('public','connections','private')),
  global_connections_visibility TEXT NOT NULL DEFAULT 'public' CHECK(global_connections_visibility IN ('public','private')),
  messaging_visibility TEXT NOT NULL DEFAULT 'connections' CHECK(messaging_visibility IN ('everyone','connections','groups','nobody')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS global_connections (
  connection_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  target_type TEXT NOT NULL CHECK(target_type IN ('profile','space')),
  target_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id,target_type,target_id),
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_global_connections_target ON global_connections(target_type,target_id);

CREATE TABLE IF NOT EXISTS spaces (
  space_id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('ministry','church','christian_organization','mission_outreach','christian_business','christian_media','music_ministry','christian_project','fellowship_network','other_approved')),
  description TEXT NOT NULL,
  country TEXT,
  state_region TEXT,
  city TEXT,
  website TEXT,
  contact_email TEXT,
  profile_photo_key TEXT,
  cover_photo_key TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK(verification_status IN ('unverified','pending','verified','rejected')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','restricted','suspended')),
  owner_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(owner_user_id) REFERENCES users(user_id)
);
CREATE TABLE IF NOT EXISTS space_members (
  space_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner','administrator','moderator','editor')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(space_id,user_id),
  FOREIGN KEY(space_id) REFERENCES spaces(space_id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS groups (
  group_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  group_type TEXT NOT NULL CHECK(group_type IN ('fellowship','prayer','bible_study','youth','women','men','family','pastors_ministers','new_converts','missions','country_city','service_team','other_christian')),
  description TEXT NOT NULL,
  christian_purpose TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','private','hidden')),
  owner_user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','restricted','suspended')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(owner_user_id) REFERENCES users(user_id)
);
CREATE TABLE IF NOT EXISTS group_members (
  group_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner','administrator','moderator','member')),
  join_status TEXT NOT NULL DEFAULT 'approved' CHECK(join_status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(group_id,user_id),
  FOREIGN KEY(group_id) REFERENCES groups(group_id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS posts (
  post_id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_user_id INTEGER NOT NULL,
  author_space_id INTEGER,
  group_id INTEGER,
  post_type TEXT NOT NULL DEFAULT 'fellowship' CHECK(post_type IN ('fellowship','prayer','testimony','bible_question','bible_answer','encouragement','mission','salvation','announcement')),
  title TEXT,
  body TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','connections','group')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','held','removed')),
  moderation_state TEXT NOT NULL DEFAULT 'allowed' CHECK(moderation_state IN ('allowed','warned','held','blocked')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(author_user_id) REFERENCES users(user_id),
  FOREIGN KEY(author_space_id) REFERENCES spaces(space_id),
  FOREIGN KEY(group_id) REFERENCES groups(group_id)
);
CREATE INDEX IF NOT EXISTS idx_posts_feed ON posts(status,created_at DESC);

CREATE TABLE IF NOT EXISTS reactions (
  reaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  post_id INTEGER NOT NULL,
  reaction_type TEXT NOT NULL CHECK(reaction_type IN ('amen','hallelujah','glory_to_god','praying','encouraged','thank_god','helpful','i_will_go','challenge_accepted')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id,post_id,reaction_type),
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY(post_id) REFERENCES posts(post_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS conversations (
  conversation_id INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_user_id INTEGER NOT NULL,
  recipient_user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','accepted','declined','blocked')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(requester_user_id,recipient_user_id),
  FOREIGN KEY(requester_user_id) REFERENCES users(user_id),
  FOREIGN KEY(recipient_user_id) REFERENCES users(user_id)
);
CREATE TABLE IF NOT EXISTS messages (
  message_id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  sender_user_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'delivered' CHECK(status IN ('delivered','held','blocked','removed')),
  moderation_state TEXT NOT NULL DEFAULT 'allowed' CHECK(moderation_state IN ('allowed','warned','held','blocked')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(conversation_id) REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  FOREIGN KEY(sender_user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS moderation_events (
  moderation_event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  surface TEXT NOT NULL CHECK(surface IN ('post','message','profile','space','group')),
  source_id INTEGER,
  decision TEXT NOT NULL CHECK(decision IN ('allow','warn','hold','block')),
  category TEXT NOT NULL,
  reasons TEXT NOT NULL DEFAULT '[]',
  excerpt TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(user_id)
);
CREATE INDEX IF NOT EXISTS idx_moderation_events_queue ON moderation_events(decision,created_at DESC);

CREATE TABLE IF NOT EXISTS prayer_circles (
  circle_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  owner_user_id INTEGER NOT NULL,
  max_members INTEGER NOT NULL DEFAULT 20 CHECK(max_members BETWEEN 3 AND 50),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('public','private')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(owner_user_id) REFERENCES users(user_id)
);
CREATE TABLE IF NOT EXISTS prayer_circle_members (
  circle_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner','leader','member')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(circle_id,user_id),
  FOREIGN KEY(circle_id) REFERENCES prayer_circles(circle_id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS prayer_items (
  prayer_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id INTEGER,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  request_text TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'community' CHECK(visibility IN ('community','connections','circle','private_ministry')),
  answered INTEGER NOT NULL DEFAULT 0,
  answer_testimony TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(circle_id) REFERENCES prayer_circles(circle_id),
  FOREIGN KEY(user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS daily_spiritual_prompts (
  prompt_date TEXT PRIMARY KEY,
  scripture_reference TEXT NOT NULL,
  scripture_text TEXT,
  reflection TEXT NOT NULL,
  prayer_focus TEXT NOT NULL,
  action_challenge TEXT NOT NULL,
  mission_focus TEXT
);
CREATE TABLE IF NOT EXISTS growth_checkins (
  user_id INTEGER NOT NULL,
  checkin_date TEXT NOT NULL,
  bible_read INTEGER NOT NULL DEFAULT 0,
  prayed INTEGER NOT NULL DEFAULT 0,
  encouraged_someone INTEGER NOT NULL DEFAULT 0,
  shared_christ INTEGER NOT NULL DEFAULT 0,
  challenge_completed INTEGER NOT NULL DEFAULT 0,
  reflection TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(user_id,checkin_date),
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS salvation_decisions (
  decision_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  name TEXT,
  email TEXT,
  country TEXT,
  decision_type TEXT NOT NULL CHECK(decision_type IN ('give_life_to_christ','rededication','need_prayer','questions_about_christ')),
  message TEXT,
  followup_status TEXT NOT NULL DEFAULT 'new' CHECK(followup_status IN ('new','contacted','discipleship','completed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  href TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id,read_at,created_at DESC);
