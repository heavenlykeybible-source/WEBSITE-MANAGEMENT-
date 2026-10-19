"""Check Account 4's ordered migration chain in isolated SQLite, never production."""
import sqlite3
from pathlib import Path

database = sqlite3.connect(":memory:")
database.execute("PRAGMA foreign_keys=ON")
paths = sorted(Path("recovery-control/migrations").glob("[0-9][0-9][0-9][0-9]_*.sql"))
for path in paths:
    database.executescript(path.read_text())
database.execute("INSERT INTO account4_security_state(key,value) VALUES(?,?)", ("hkem-control-password-v2", "sha256:preserve-owner-password"))
database.execute("INSERT INTO recovery_events(account_no,action,target_ref,detail) VALUES('1','review',?,'preserve audit')", ("a" * 40,))
database.execute("INSERT INTO account4_connector_audit(provider,action) VALUES('gemini','rotate')")
# New additive migrations must be repeatable without touching existing owner state.
for path in paths:
    if int(path.name[:4]) >= 5:
        database.executescript(path.read_text())
assert database.execute("SELECT value FROM account4_security_state WHERE key='hkem-control-password-v2'").fetchone()[0] == "sha256:preserve-owner-password"
assert database.execute("SELECT count(*) FROM recovery_events").fetchone()[0] == 1
assert database.execute("SELECT count(*) FROM account4_connector_audit").fetchone()[0] == 1
assert database.execute("PRAGMA foreign_key_check").fetchall() == []
print(f"Account 4 migration chain passed: {len(paths)} ordered migrations; owner credentials and audit records preserved.")
