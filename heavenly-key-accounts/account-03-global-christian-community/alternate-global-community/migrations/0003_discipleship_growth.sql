PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS discipleship_tracks (
  track_id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS discipleship_lessons (
  lesson_id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id INTEGER NOT NULL,
  lesson_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  scripture_reference TEXT NOT NULL,
  lesson_text TEXT NOT NULL,
  reflection_question TEXT,
  action_step TEXT,
  UNIQUE(track_id,lesson_order),
  FOREIGN KEY(track_id) REFERENCES discipleship_tracks(track_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS discipleship_progress (
  user_id INTEGER NOT NULL,
  lesson_id INTEGER NOT NULL,
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  reflection TEXT,
  PRIMARY KEY(user_id,lesson_id),
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY(lesson_id) REFERENCES discipleship_lessons(lesson_id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO discipleship_tracks(track_id,slug,title,description,audience,sort_order) VALUES
(1,'new-believer-foundations','New Believer Foundations','A simple Christ-centred pathway for people beginning or renewing their walk with Jesus Christ.','new_believer',1),
(2,'growing-in-christ','Growing in Christ','Practical habits for Bible growth, prayer, holiness, fellowship, service and evangelism.','all',2);

INSERT OR IGNORE INTO discipleship_lessons(lesson_id,track_id,lesson_order,title,scripture_reference,lesson_text,reflection_question,action_step) VALUES
(1,1,1,'Salvation Through Jesus Christ','John 3:16; Acts 4:12','Salvation is God’s gift through Jesus Christ. Turn from sin, trust Christ, and begin a life of following Him.','What does it mean for you to trust Jesus Christ?','Thank God for salvation and tell Him plainly that you want to follow Christ.'),
(2,1,2,'Assurance and a New Life','2 Corinthians 5:17; Romans 8:1','In Christ you are called into a new life. Growth begins by trusting God’s Word rather than living under the control of your former life.','What old pattern do you need God to help you leave behind?','Write one change you will begin making in obedience to Christ.'),
(3,1,3,'Learning the Bible','Psalm 119:105; 2 Timothy 3:16-17','The Scriptures teach, correct and equip believers. Read prayerfully, consistently and with a heart ready to obey.','What Bible-reading habit can you keep consistently?','Read one Gospel chapter today and write down one thing to obey.'),
(4,1,4,'Learning to Pray','Matthew 6:6-13; Philippians 4:6','Prayer is fellowship with God. Worship Him, confess sin, give thanks, bring your needs and pray for others.','What burden should you bring honestly before God today?','Spend at least ten quiet minutes praying without distraction.'),
(5,2,1,'Holiness in Daily Life','1 Peter 1:15-16; Hebrews 12:14','Christ calls believers to a holy life in thoughts, words, relationships, work and private conduct. Holiness grows through grace, truth and obedience.','Where is God asking you to become more obedient?','Remove one known stumbling block and ask God for strength to walk uprightly.'),
(6,2,2,'Christian Fellowship','Hebrews 10:24-25; John 13:34-35','Believers need one another for encouragement, prayer, correction and service. Fellowship should build faith rather than pride or rivalry.','Who can you encourage in Christ today?','Encourage one believer with Scripture, prayer or a sincere message.'),
(7,2,3,'Sharing Christ','Matthew 28:19-20; Romans 1:16','Every believer can participate in the Great Commission through prayer, witness, service and support for gospel work.','Who around you needs to hear about Jesus?','Pray for one person and look for a respectful opportunity to share Christ.'),
(8,2,4,'Serving With Your Gifts','1 Peter 4:10; Ephesians 4:11-13','God gives believers different gifts and opportunities to serve. Christian service is for building others, not self-exaltation.','How can your abilities serve another person or the gospel?','Choose one practical act of Christian service this week.');
