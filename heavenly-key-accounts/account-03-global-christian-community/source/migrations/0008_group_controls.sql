ALTER TABLE groups ADD COLUMN rules TEXT NOT NULL DEFAULT '';
ALTER TABLE groups ADD COLUMN join_approval INTEGER NOT NULL DEFAULT 0 CHECK(join_approval IN (0,1));
ALTER TABLE groups ADD COLUMN posting_policy TEXT NOT NULL DEFAULT 'members' CHECK(posting_policy IN ('members','managers'));
UPDATE groups SET join_approval=1 WHERE visibility!='public';
