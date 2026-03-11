-- ============================================
-- DreamPig Football — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================

-- Players table
CREATE TABLE IF NOT EXISTS players (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  position TEXT NOT NULL DEFAULT 'Midfielder',
  rating INT NOT NULL DEFAULT 3 CHECK (rating >= 1 AND rating <= 5),
  passing INT NOT NULL DEFAULT 3 CHECK (passing >= 1 AND passing <= 5),
  shooting INT NOT NULL DEFAULT 3 CHECK (shooting >= 1 AND shooting <= 5),
  defending INT NOT NULL DEFAULT 3 CHECK (defending >= 1 AND defending <= 5),
  dribbling INT NOT NULL DEFAULT 3 CHECK (dribbling >= 1 AND dribbling <= 5),
  stamina INT NOT NULL DEFAULT 3 CHECK (stamina >= 1 AND stamina <= 5),
  avg_score REAL NOT NULL DEFAULT 0,
  matches_played INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Friendly Match',
  date DATE NOT NULL,
  time TIME NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'completed', 'cancelled')),
  team_a_json JSONB DEFAULT '[]',
  team_b_json JSONB DEFAULT '[]',
  qr_image_path TEXT,
  fee REAL DEFAULT 0,
  score_a INT DEFAULT NULL,
  score_b INT DEFAULT NULL,
  team_a_name TEXT NOT NULL DEFAULT 'Team A',
  team_b_name TEXT NOT NULL DEFAULT 'Team B',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Match players (registration & team assignment)
CREATE TABLE IF NOT EXISTS match_players (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team TEXT CHECK (team IN ('A', 'B', 'SUB_A', 'SUB_B')),
  available BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(match_id, player_id)
);

-- Match player stats (goals, assists)
CREATE TABLE IF NOT EXISTS match_player_stats (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  goals INT NOT NULL DEFAULT 0,
  assists INT NOT NULL DEFAULT 0,
  UNIQUE(match_id, player_id)
);

-- Match evaluations
CREATE TABLE IF NOT EXISTS evaluations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  passing INT NOT NULL DEFAULT 3 CHECK (passing >= 1 AND passing <= 5),
  shooting INT NOT NULL DEFAULT 3 CHECK (shooting >= 1 AND shooting <= 5),
  defending INT NOT NULL DEFAULT 3 CHECK (defending >= 1 AND defending <= 5),
  dribbling INT NOT NULL DEFAULT 3 CHECK (dribbling >= 1 AND dribbling <= 5),
  stamina INT NOT NULL DEFAULT 3 CHECK (stamina >= 1 AND stamina <= 5),
  overall_score REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(match_id, player_id)
);

-- Payment tracking
CREATE TABLE IF NOT EXISTS payments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  paid BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(match_id, player_id)
);

-- ============================================
-- Row Level Security — permissive for all
-- ============================================

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anonymous/authenticated users
CREATE POLICY "Allow all on players" ON players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on matches" ON matches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on match_players" ON match_players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on match_player_stats" ON match_player_stats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on evaluations" ON evaluations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on payments" ON payments FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Storage bucket for QR code images
-- ============================================
-- NOTE: Create this bucket manually in Supabase Dashboard > Storage
-- Bucket name: qr-codes
-- Set to PUBLIC so images can be viewed without auth
-- Or run this via the Supabase SQL Editor:

INSERT INTO storage.buckets (id, name, public) VALUES ('qr-codes', 'qr-codes', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to qr-codes bucket
CREATE POLICY "Allow public read qr-codes" ON storage.objects
  FOR SELECT USING (bucket_id = 'qr-codes');

CREATE POLICY "Allow public insert qr-codes" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'qr-codes');

CREATE POLICY "Allow public update qr-codes" ON storage.objects
  FOR UPDATE USING (bucket_id = 'qr-codes');
