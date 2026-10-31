"""Exercise pending Account 4 SQL migrations in SQLite, without touching production."""
import pathlib
import sqlite3

root = pathlib.Path(__file__).resolve().parents[1]
db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys = ON")
db.execute("CREATE TABLE users (id INTEGER PRIMARY KEY)")
db.execute("INSERT INTO users(id) VALUES (7)")
for name in ("account4-private-imports.sql", "account4-import-release-attestations.sql"):
    db.executescript((root / "migrations" / name).read_text(encoding="utf-8"))

ident = "123e4567-e89b-42d3-a456-426614174000"
key = "private-imports/7/" + ident
db.execute("""INSERT INTO account4_import_sessions
    (id,owner_id,object_key,upload_id,filename,size_bytes,part_count,state,expires_at_ms)
    VALUES (?,?,?,?,?,?,?,?,?)""",
    (ident,7,key,"upload-123","archive.zip",100,1,"private-awaiting-review",4102444800000))
digest = "a" * 64
db.execute("""INSERT INTO account4_import_release_attestations
    (session_id,object_key,size_bytes,verdict,scanned_at,scanned_version,scanned_etag,
    scanned_sha256,approved_sha256,approved_by,approved_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
    (ident,key,100,"clean","2026-10-31T11:00:00Z","version-123456","a"*32,
     digest,digest,7,"2026-10-31T12:00:00Z"))

def rejected(sql, params):
    try:
        db.execute(sql, params)
    except sqlite3.IntegrityError:
        return
    raise AssertionError("Expected database constraint failure: " + sql)

rejected("UPDATE account4_import_sessions SET state=? WHERE id=?", ("published",ident))
rejected("UPDATE account4_import_release_attestations SET verdict=? WHERE session_id=?", ("unknown",ident))
rejected("UPDATE account4_import_release_attestations SET scanned_sha256=? WHERE session_id=?", ("X"*64,ident))
rejected("UPDATE account4_import_release_attestations SET approved_sha256=? WHERE session_id=?", ("short",ident))
rejected("UPDATE account4_import_release_attestations SET approved_by=NULL WHERE session_id=?", (ident,))
rejected("UPDATE account4_import_release_attestations SET size_bytes=? WHERE session_id=?", (0,ident))
rejected("UPDATE account4_import_release_attestations SET verdict=? WHERE session_id=?", ("malicious",ident))
rejected("UPDATE account4_import_release_attestations SET scanned_sha256=? WHERE session_id=?", ("b"*64,ident))
rejected("UPDATE account4_import_release_attestations SET approved_at=? WHERE session_id=?", ("2026-10-31T10:00:00Z",ident))
rejected("UPDATE account4_import_release_attestations SET scanned_at=NULL WHERE session_id=?", (ident,))
rejected("UPDATE account4_import_release_attestations SET scanned_version=NULL WHERE session_id=?", (ident,))
rejected("UPDATE account4_import_release_attestations SET scanned_etag=NULL WHERE session_id=?", (ident,))

db.execute("DELETE FROM account4_import_sessions WHERE id=?", (ident,))
assert db.execute("SELECT COUNT(*) FROM account4_import_release_attestations").fetchone()[0] == 0
assert db.execute("PRAGMA foreign_key_check").fetchall() == []
print("PASS Account 4 migration SQL constraints, scan hashes, approvals and cascading cleanup")
