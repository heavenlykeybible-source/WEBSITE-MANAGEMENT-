PRAGMA foreign_keys=ON;
-- No member is enrolled in encouragement or request reminders by this migration.
CREATE TABLE care_preferences (
 user_id INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
 frequency TEXT NOT NULL DEFAULT 'off' CHECK(frequency IN ('off','daily','weekly')),
 timezone TEXT NOT NULL DEFAULT 'UTC', delivery_hour INTEGER NOT NULL DEFAULT 8 CHECK(delivery_hour BETWEEN 0 AND 23),
 weekly_day INTEGER NOT NULL DEFAULT 0 CHECK(weekly_day BETWEEN 0 AND 6),
 prayer_reminders INTEGER NOT NULL DEFAULT 1 CHECK(prayer_reminders IN (0,1)),
 next_delivery_at INTEGER, updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX care_preferences_due ON care_preferences(next_delivery_at) WHERE frequency!='off';
CREATE TABLE care_readings (
 reading_id INTEGER PRIMARY KEY, reference TEXT NOT NULL, scripture TEXT NOT NULL, prayer TEXT NOT NULL,
 approved INTEGER NOT NULL DEFAULT 0 CHECK(approved IN (0,1)), approved_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL, approved_at TEXT
);
INSERT INTO care_readings(reading_id,reference,scripture,prayer) VALUES
(1,'Psalm 27:14','Wait on the LORD: be of good courage, and he shall strengthen thine heart: wait, I say, on the LORD.','Lord, strengthen my heart today and help me trust Your timing. Amen.'),
(2,'Psalm 46:1','God is our refuge and strength, a very present help in trouble.','Lord, help me turn to You for refuge and strength today. Amen.'),
(3,'1 Peter 5:7','Casting all your care upon him; for he careth for you.','Father, help me bring my burdens to You and remember Your care. Amen.'),
(4,'Psalm 119:105','Thy word is a lamp unto my feet, and a light unto my path.','Lord, guide my choices through Your Word today. Amen.'),
(5,'Philippians 4:6','Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.','Father, help me pray with thanksgiving rather than carry my worries alone. Amen.'),
(6,'Galatians 6:9','And let us not be weary in well doing: for in due season we shall reap, if we faint not.','Lord, give me strength to continue doing what is right. Amen.'),
(7,'John 14:27','Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid.','Lord Jesus, help me rest in Your peace and walk faithfully today. Amen.');
ALTER TABLE prayer_items ADD COLUMN care_status TEXT NOT NULL DEFAULT 'waiting' CHECK(care_status IN ('waiting','updated','testimony','closed'));
ALTER TABLE prayer_items ADD COLUMN care_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE prayer_items ADD COLUMN care_reminder_at INTEGER;
CREATE INDEX prayer_care_due ON prayer_items(care_reminder_at) WHERE care_reminder_at IS NOT NULL;
CREATE TABLE prayer_support (
 prayer_item_id INTEGER NOT NULL REFERENCES prayer_items(prayer_item_id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
 follow_updates INTEGER NOT NULL DEFAULT 0 CHECK(follow_updates IN (0,1)), created_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(prayer_item_id,user_id)
);
CREATE TABLE prayer_updates (
 update_id INTEGER PRIMARY KEY AUTOINCREMENT, prayer_item_id INTEGER NOT NULL REFERENCES prayer_items(prayer_item_id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('waiting','updated','testimony','closed')), body TEXT NOT NULL DEFAULT '',
 request_key TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(prayer_item_id,request_key)
);
CREATE INDEX prayer_updates_item ON prayer_updates(prayer_item_id,update_id DESC);
-- One durable ledger row and its notification are committed together; retries cannot duplicate them.
CREATE TABLE care_deliveries (
 user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
 delivery_key TEXT NOT NULL, item_id INTEGER NOT NULL, next_at INTEGER,
 created_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY(user_id,delivery_key)
);
CREATE TRIGGER care_delivery_guard BEFORE INSERT ON care_deliveries BEGIN
 SELECT CASE WHEN substr(NEW.delivery_key,1,2)='e:' AND NOT EXISTS(
  SELECT 1 FROM care_preferences cp JOIN users u ON u.user_id=cp.user_id JOIN care_readings cr ON cr.reading_id=NEW.item_id
  WHERE cp.user_id=NEW.user_id AND cp.frequency!='off' AND cp.next_delivery_at<=unixepoch('now')*1000 AND cr.approved=1 AND u.status='active'
 ) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN substr(NEW.delivery_key,1,2)='p:' AND NOT EXISTS(
  SELECT 1 FROM prayer_items pi JOIN users u ON u.user_id=pi.user_id LEFT JOIN care_preferences cp ON cp.user_id=pi.user_id
  WHERE pi.prayer_item_id=NEW.item_id AND pi.user_id=NEW.user_id AND NEW.delivery_key='p:'||pi.prayer_item_id||':'||pi.care_version
   AND pi.care_reminder_at<=unixepoch('now')*1000 AND pi.care_status NOT IN ('closed','testimony') AND pi.answered=0 AND COALESCE(cp.prayer_reminders,1)=1 AND u.status='active'
 ) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN substr(NEW.delivery_key,1,2) NOT IN ('e:','p:') THEN RAISE(ABORT,'Invalid care delivery') END;
END;
CREATE TRIGGER care_encouragement_delivered AFTER INSERT ON care_deliveries WHEN substr(NEW.delivery_key,1,2)='e:' BEGIN
 INSERT INTO notifications(user_id,kind,title,body,href)
 SELECT NEW.user_id,'care_encouragement','Community Care · A word of encouragement',scripture||char(10)||'— '||reference||' (KJV)'||char(10)||char(10)||'Ministry-approved prayer: '||prayer,'/prayer.html?care=encouragement' FROM care_readings WHERE reading_id=NEW.item_id;
 UPDATE care_preferences SET next_delivery_at=NEW.next_at WHERE user_id=NEW.user_id;
END;
CREATE TRIGGER care_prayer_reminded AFTER INSERT ON care_deliveries WHEN substr(NEW.delivery_key,1,2)='p:' BEGIN
 INSERT INTO notifications(user_id,kind,title,body,href) VALUES(NEW.user_id,'care_followup','Community Care · How are you doing?','Would you like to update your prayer request? You can keep trusting God, share an update or testimony, or close the request. Your current audience will stay the same.','/prayer.html?request='||NEW.item_id);
 UPDATE prayer_items SET care_reminder_at=NULL WHERE prayer_item_id=NEW.item_id;
END;

-- A same-day retry advances scheduling without sending another encouragement.
CREATE TRIGGER care_encouragement_rescheduled AFTER UPDATE OF next_at ON care_deliveries WHEN substr(NEW.delivery_key,1,2)='e:' BEGIN
 UPDATE care_preferences SET next_delivery_at=NEW.next_at WHERE user_id=NEW.user_id AND frequency!='off' AND next_delivery_at<=unixepoch('now')*1000;
END;

CREATE INDEX notifications_care_followup ON notifications(user_id,href,created_at DESC) WHERE kind='care_prayer_update';
