-- ============================================================
-- Global Christian Platform — Module 1: Authentication
-- Cloudflare D1 Schema (SQLite dialect)
-- ============================================================

CREATE TABLE users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    country TEXT NOT NULL,
    profile_photo_url TEXT,
    bio TEXT,
    status TEXT NOT NULL DEFAULT 'active', -- active | suspended | deleted (soft delete, Rule B)
    role_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by INTEGER,
    updated_by INTEGER,
    FOREIGN KEY (role_id) REFERENCES roles(role_id)
);

CREATE TABLE auth (
    auth_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,       -- PBKDF2-SHA256 via Web Crypto SubtleCrypto (Workers-compatible)
    password_salt TEXT NOT NULL,
    email_verified INTEGER NOT NULL DEFAULT 0, -- boolean
    verification_token TEXT,
    verification_expires_at TEXT,
    reset_token TEXT,
    reset_token_expires_at TEXT,
    last_login TEXT,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE roles (
    role_id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_name TEXT NOT NULL UNIQUE  -- Guest, Member, Moderator, Administrator, Deputy Super Administrator, Super Administrator
);

CREATE TABLE permissions (
    permission_id INTEGER PRIMARY KEY AUTOINCREMENT,
    permission_name TEXT NOT NULL UNIQUE
);

CREATE TABLE role_permissions (
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(role_id),
    FOREIGN KEY (permission_id) REFERENCES permissions(permission_id)
);

-- Seed default roles
INSERT INTO roles (role_name) VALUES
    ('Guest'), ('Member'), ('Moderator'), ('Administrator'),
    ('Deputy Super Administrator'), ('Super Administrator');

-- Rate limiting is handled in Cloudflare KV, not D1 (per Security Notes, Section 5.2
-- of the Module 1 wireframe) — key pattern: ratelimit:login:{ip}:{email}, ratelimit:register:{ip}
