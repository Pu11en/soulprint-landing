-- Blueprints table for idea tracking
CREATE TABLE IF NOT EXISTS blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'product', 'feature', 'marketing', 'infrastructure', 'content'
  
  -- Scoring
  impact_score INTEGER CHECK (impact_score >= 1 AND impact_score <= 10),
  feasibility_score INTEGER CHECK (feasibility_score >= 1 AND feasibility_score <= 10),
  priority_score NUMERIC GENERATED ALWAYS AS (impact_score * feasibility_score) STORED,
  effort_estimate TEXT, -- 'hours', 'days', 'weeks', 'months'
  
  -- Status tracking
  status TEXT DEFAULT 'idea', -- 'idea', 'spec', 'building', 'shipped', 'archived'
  
  -- Source tracking
  source_type TEXT, -- 'slack', 'manual', 'conversation'
  source_url TEXT,
  source_author TEXT,
  source_timestamp TIMESTAMPTZ,
  
  -- Metadata
  tags TEXT[],
  notes TEXT,
  spec_doc TEXT, -- Full specification document
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for priority ranking
CREATE INDEX IF NOT EXISTS idx_blueprints_priority ON blueprints (priority_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_blueprints_status ON blueprints (status);
CREATE INDEX IF NOT EXISTS idx_blueprints_category ON blueprints (category);

-- Enable RLS
ALTER TABLE blueprints ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can read
CREATE POLICY "Blueprints are viewable by authenticated users" ON blueprints
  FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: Only service role can insert/update (for bot operations)
CREATE POLICY "Service role can manage blueprints" ON blueprints
  FOR ALL USING (auth.role() = 'service_role');
