
CREATE TABLE grdpc_settings(id INTEGER PRIMARY KEY CHECK(id=1),config TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
INSERT INTO grdpc_settings VALUES(1,'{"enabled":false,"timingConfirmed":false,"phone":"","accountId":null,"template":"","language":"en","dailyLimit":100,"reminders":[{"day":5,"time":"20:00"},{"day":6,"time":"20:00"},{"day":0,"time":"16:00"},{"day":0,"time":"19:00"}]}',CURRENT_TIMESTAMP);
CREATE TABLE grdpc_subscribers(contact_id INTEGER NOT NULL REFERENCES whatsapp_contacts(contact_id),phone_id TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('subscribed','unsubscribed')),consented_at TEXT,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(contact_id,phone_id));
CREATE TABLE grdpc_deliveries(id INTEGER PRIMARY KEY AUTOINCREMENT,contact_id INTEGER NOT NULL,phone_id TEXT NOT NULL,slot TEXT NOT NULL,day TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'claimed',provider_id TEXT,error TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(contact_id,phone_id,slot));
CREATE INDEX grdpc_daily_budget ON grdpc_deliveries(day);
