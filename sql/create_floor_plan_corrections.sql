-- Floor Plan Corrections table for feedback loop
-- Run this in Supabase SQL Editor to create the table

CREATE TABLE IF NOT EXISTS floor_plan_corrections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  image_hash TEXT NOT NULL,
  original_walls INTEGER DEFAULT 0,
  corrected_walls INTEGER DEFAULT 0,
  original_doors INTEGER DEFAULT 0,
  corrected_doors INTEGER DEFAULT 0,
  original_ai_output JSONB,
  user_corrections JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: users can only insert their own corrections
ALTER TABLE floor_plan_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own corrections"
  ON floor_plan_corrections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own corrections"
  ON floor_plan_corrections FOR SELECT
  USING (auth.uid() = user_id);

-- Index for querying common corrections
CREATE INDEX idx_corrections_created ON floor_plan_corrections(created_at DESC);
CREATE INDEX idx_corrections_image ON floor_plan_corrections(image_hash);
