-- Run once on your Cloudflare D1 database (already applied to "live-studio-teams").
CREATE TABLE IF NOT EXISTS teams(id TEXT PRIMARY KEY, name TEXT NOT NULL, owner TEXT NOT NULL, created INTEGER NOT NULL, ttl INTEGER NOT NULL DEFAULT 30);
CREATE TABLE IF NOT EXISTS members(team TEXT NOT NULL, email TEXT NOT NULL, name TEXT, role TEXT NOT NULL, joined INTEGER NOT NULL, PRIMARY KEY(team, email));
CREATE INDEX IF NOT EXISTS members_email ON members(email);
CREATE TABLE IF NOT EXISTS invites(code TEXT PRIMARY KEY, team TEXT NOT NULL, by TEXT NOT NULL, expires INTEGER NOT NULL, uses INTEGER NOT NULL DEFAULT 0, max INTEGER NOT NULL DEFAULT 50);
CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT, team TEXT NOT NULL, sender TEXT NOT NULL, name TEXT, text TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'msg', meta TEXT, ts INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS messages_team ON messages(team, id);
CREATE TABLE IF NOT EXISTS meetings(id TEXT PRIMARY KEY, team TEXT NOT NULL, title TEXT, started INTEGER NOT NULL, ended INTEGER, link TEXT);
CREATE INDEX IF NOT EXISTS meetings_team ON meetings(team, started);
CREATE TABLE IF NOT EXISTS attendance(meeting TEXT NOT NULL, email TEXT NOT NULL, name TEXT, first INTEGER NOT NULL, joined INTEGER NOT NULL, PRIMARY KEY(meeting, email));
CREATE TABLE IF NOT EXISTS programs(id TEXT PRIMARY KEY, owner TEXT NOT NULL, title TEXT NOT NULL, descr TEXT, start INTEGER, watch TEXT, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS programs_owner ON programs(owner);

-- Accounts, plans, channel connections, payments and rate limits (these replaced Cloudflare KV so the free plan's 1,000 writes a day is not a limit)
CREATE TABLE IF NOT EXISTS users(email TEXT PRIMARY KEY, salt TEXT NOT NULL, hash TEXT NOT NULL, paid INTEGER NOT NULL DEFAULT 0, verified INTEGER NOT NULL DEFAULT 1, banned INTEGER NOT NULL DEFAULT 0, tv INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, terms TEXT, termsAt INTEGER, seen INTEGER NOT NULL DEFAULT 0, warned INTEGER NOT NULL DEFAULT 0, role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('owner','admin','user')));
CREATE TABLE IF NOT EXISTS conns(email TEXT NOT NULL, id TEXT NOT NULL, kind TEXT NOT NULL, name TEXT, sec TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(email, id));
CREATE TABLE IF NOT EXISTS payments(ref TEXT PRIMARY KEY, email TEXT NOT NULL, plan TEXT, amount REAL, cur TEXT, ts INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS limits(k TEXT PRIMARY KEY, n INTEGER NOT NULL, exp INTEGER NOT NULL);
