-- ─────────────────────────────────────────────────────────────────────────
-- ÉTOILE — Supabase Schema
-- Paste this entire file into: supabase.com → your project → SQL Editor → Run
-- Safe to re-run — uses IF NOT EXISTS / OR REPLACE / IF EXISTS throughout
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email      TEXT,
  name       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own profile" ON profiles;
CREATE POLICY "Own profile" ON profiles FOR ALL USING (auth.uid() = id);

-- 2. Preferences (one row per user)
CREATE TABLE IF NOT EXISTS preferences (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  onboarded        BOOLEAN DEFAULT FALSE,
  pinterest_url    TEXT,
  budget           TEXT,
  brands_liked     JSONB DEFAULT '[]',
  brands_disliked  JSONB DEFAULT '[]',
  colors_love      JSONB DEFAULT '[]',
  colors_avoid     JSONB DEFAULT '[]',
  fit              JSONB DEFAULT '[]',
  sizes            JSONB DEFAULT '{}',
  inspo_count      INTEGER DEFAULT 0,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own preferences" ON preferences;
CREATE POLICY "Own preferences" ON preferences FOR ALL USING (auth.uid() = user_id);

-- 3. Closet items
CREATE TABLE IF NOT EXISTS closet_items (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  brand       TEXT,
  category    TEXT,
  description TEXT,
  image_url   TEXT,
  worn_often  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE closet_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own closet" ON closet_items;
CREATE POLICY "Own closet" ON closet_items FOR ALL USING (auth.uid() = user_id);

-- 4. Saved looks
CREATE TABLE IF NOT EXISTS saved_looks (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  look_key   TEXT,
  name       TEXT,
  occasion   TEXT,
  caption    TEXT,
  image      TEXT,
  gradient   TEXT,
  query      TEXT,
  saved_at   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE saved_looks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own looks" ON saved_looks;
CREATE POLICY "Own looks" ON saved_looks FOR ALL USING (auth.uid() = user_id);

-- 5. Wishlist
CREATE TABLE IF NOT EXISTS wishlist_items (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT,
  brand      TEXT,
  price      TEXT,
  shop_url   TEXT,
  image      TEXT,
  retailer   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own wishlist" ON wishlist_items;
CREATE POLICY "Own wishlist" ON wishlist_items FOR ALL USING (auth.uid() = user_id);

-- 6. Storage bucket for closet photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('closet-photos', 'closet-photos', true)
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "Upload own photos" ON storage.objects;
CREATE POLICY "Upload own photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'closet-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
DROP POLICY IF EXISTS "Read closet photos" ON storage.objects;
CREATE POLICY "Read closet photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'closet-photos');
DROP POLICY IF EXISTS "Delete own photos" ON storage.objects;
CREATE POLICY "Delete own photos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'closet-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
