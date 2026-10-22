-- Owner-authorized initial password bootstrap. Never replaces an existing password.
-- Only a salted PBKDF2 digest is stored here. The random password is delivered privately to the owner.
INSERT INTO cms_owner_password(id,password_hash,salt,updated_by) SELECT 1,'6ded2e508d4d1c7aa735084adb178011209ee1a9dbd1573cad5dee6e8d2b7b25','e77d6a0ea9875c0fd36af083658230da54458d071d2b72ba0cb9ddae5ecd8dd7','project-owner' WHERE NOT EXISTS(SELECT 1 FROM cms_owner_password WHERE id=1);
INSERT INTO cms_audit(actor,action,target) SELECT 'project-owner','owner-password-bootstrap','owner-signin' WHERE changes()>0;

