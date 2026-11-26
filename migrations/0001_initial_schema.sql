-- Lernwelt: initiales Datenbankschema (Cloudflare D1 / SQLite)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'book',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 0,
  UNIQUE(subject_id, title)
);

CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_json TEXT NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  lesson_id TEXT REFERENCES lessons(id) ON DELETE CASCADE,
  chapter_id TEXT REFERENCES chapters(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL CHECK (question_type IN (
    'multiple_choice', 'free_text', 'fill_blank', 'matching',
    'true_false', 'vocabulary', 'exam'
  )),
  prompt TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  answer_config_json TEXT NOT NULL DEFAULT '{}',
  difficulty TEXT NOT NULL DEFAULT 'normal' CHECK (difficulty IN ('easy', 'normal', 'hard')),
  points REAL NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 0,
  CHECK (lesson_id IS NOT NULL OR chapter_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_questions_lesson ON questions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_questions_chapter ON questions(chapter_id);

CREATE TABLE IF NOT EXISTS answer_concepts (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  concept_label TEXT NOT NULL,
  aliases_json TEXT NOT NULL DEFAULT '[]',
  required INTEGER NOT NULL DEFAULT 1 CHECK (required IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vocabulary_sets (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'both' CHECK (direction IN ('forward', 'reverse', 'both')),
  is_published INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vocabulary_items (
  id TEXT PRIMARY KEY,
  set_id TEXT NOT NULL REFERENCES vocabulary_sets(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  example TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id TEXT REFERENCES questions(id) ON DELETE SET NULL,
  mode TEXT NOT NULL CHECK (mode IN ('practice', 'exam', 'vocabulary')),
  user_answer TEXT NOT NULL DEFAULT '',
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  points_earned REAL NOT NULL DEFAULT 0,
  points_possible REAL NOT NULL DEFAULT 0,
  answered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_attempts_user_date ON attempts(user_id, answered_at);

CREATE TABLE IF NOT EXISTS learning_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  completed_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  last_position TEXT NOT NULL DEFAULT '',
  last_activity_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id, chapter_id)
);

CREATE TABLE IF NOT EXISTS exam_results (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 0,
  max_score REAL NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_exam_results_user ON exam_results(user_id, completed_at);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  settings_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);