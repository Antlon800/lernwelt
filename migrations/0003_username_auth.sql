-- Lernwelt: Anmeldung künftig mit Benutzername statt E-Mail-Adresse.
-- Bestehende Konten behalten einen nutzbaren Benutzernamen auf Basis ihres bisherigen Anzeigenamens.
ALTER TABLE users ADD COLUMN username TEXT;

UPDATE users
SET username = CASE
  WHEN trim(display_name) = '' THEN 'user_' || substr(id, 1, 8)
  WHEN (
    SELECT COUNT(*) FROM users AS earlier
    WHERE lower(trim(earlier.display_name)) = lower(trim(users.display_name))
      AND earlier.id < users.id
  ) = 0 THEN trim(display_name)
  ELSE trim(display_name) || '_' || substr(id, 1, 6)
END;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username COLLATE NOCASE);