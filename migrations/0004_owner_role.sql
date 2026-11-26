-- Owner-Berechtigung ergänzen. Die bestehende role-Spalte bleibt für student/admin erhalten.
-- Der partielle Unique-Index garantiert, dass es höchstens einen Owner gibt.
ALTER TABLE users ADD COLUMN is_owner INTEGER NOT NULL DEFAULT 0 CHECK (is_owner IN (0, 1));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_single_owner ON users(is_owner) WHERE is_owner = 1;