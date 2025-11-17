-- Initial Schema Migration for ViraCut MVP
-- This migration creates the core database structure for the ViraCut application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (leveraging Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100),
  avatar_url TEXT,
  subscription_tier VARCHAR(20) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  campaign_type VARCHAR(30) NOT NULL CHECK (campaign_type IN ('product-launch', 'social-ad', 'brand-awareness', 'event-promotion', 'educational-content')),
  aspect_ratio VARCHAR(10) NOT NULL CHECK (aspect_ratio IN ('9:16', '16:9', '1:1')),
  target_duration INTEGER NOT NULL CHECK (target_duration IN (15, 30, 60)),
  brand_colors JSONB,
  brand_logo_url TEXT,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'completed', 'error')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Nodes table
CREATE TABLE IF NOT EXISTS nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('video', 'image', 'text', 'audio', 'effect', 'shape', 'logo', 'timing', 'export', 'comment')),
  position JSONB NOT NULL,
  data JSONB NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Connections table
CREATE TABLE IF NOT EXISTS connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  source_handle VARCHAR(50) NOT NULL,
  target_handle VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(source_node_id, source_handle, target_node_id, target_handle),
  CHECK(source_node_id != target_node_id)
);

-- Assets table
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(10) NOT NULL CHECK (type IN ('video', 'image', 'audio', 'logo')),
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  size BIGINT NOT NULL CHECK (size > 0),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Exports table
CREATE TABLE IF NOT EXISTS exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  settings JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  url TEXT,
  size BIGINT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_nodes_project_id ON nodes(project_id);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
CREATE INDEX IF NOT EXISTS idx_connections_project_id ON connections(project_id);
CREATE INDEX IF NOT EXISTS idx_assets_project_id ON assets(project_id);
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);
CREATE INDEX IF NOT EXISTS idx_exports_project_id ON exports(project_id);
CREATE INDEX IF NOT EXISTS idx_exports_status ON exports(status);

-- Row Level Security (RLS) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY IF NOT EXISTS "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY IF NOT EXISTS "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Projects policies
CREATE POLICY IF NOT EXISTS "Users can view own projects" ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can create own projects" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can update own projects" ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can delete own projects" ON projects FOR DELETE USING (auth.uid() = user_id);

-- Nodes policies (inherited through projects)
CREATE POLICY IF NOT EXISTS "Users can view nodes of own projects" ON nodes FOR SELECT USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = nodes.project_id AND projects.user_id = auth.uid())
);
CREATE POLICY IF NOT EXISTS "Users can manage nodes of own projects" ON nodes FOR ALL USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = nodes.project_id AND projects.user_id = auth.uid())
);

-- Connections policies (inherited through projects)
CREATE POLICY IF NOT EXISTS "Users can view connections of own projects" ON connections FOR SELECT USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = connections.project_id AND projects.user_id = auth.uid())
);
CREATE POLICY IF NOT EXISTS "Users can manage connections of own projects" ON connections FOR ALL USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = connections.project_id AND projects.user_id = auth.uid())
);

-- Assets policies (inherited through projects)
CREATE POLICY IF NOT EXISTS "Users can view assets of own projects" ON assets FOR SELECT USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = assets.project_id AND projects.user_id = auth.uid())
);
CREATE POLICY IF NOT EXISTS "Users can manage assets of own projects" ON assets FOR ALL USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = assets.project_id AND projects.user_id = auth.uid())
);

-- Exports policies (inherited through projects)
CREATE POLICY IF NOT EXISTS "Users can view exports of own projects" ON exports FOR SELECT USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = exports.project_id AND projects.user_id = auth.uid())
);
CREATE POLICY IF NOT EXISTS "Users can manage exports of own projects" ON exports FOR ALL USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = exports.project_id AND projects.user_id = auth.uid())
);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at timestamp
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_nodes_updated_at BEFORE UPDATE ON nodes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();