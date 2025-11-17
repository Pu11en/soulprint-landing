-- Seed data for ViraCut MVP
-- This file contains initial data for development and testing

-- Note: This seed file assumes you have already run the initial schema migration

-- Insert sample users (these would normally be created through Supabase Auth)
-- For development purposes only
INSERT INTO users (id, email, name, subscription_tier) VALUES 
('00000000-0000-0000-0000-000000000001', 'demo@viracut.com', 'Demo User', 'pro'),
('00000000-0000-0000-0000-000000000002', 'test@viracut.com', 'Test User', 'free')
ON CONFLICT (id) DO NOTHING;

-- Insert sample projects
INSERT INTO projects (id, user_id, name, campaign_type, aspect_ratio, target_duration, brand_colors, status) VALUES 
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Product Launch Video', 'product-launch', '9:16', 30, '["#FF6B6B", "#4ECDC4", "#45B7D1"]', 'draft'),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Social Media Ad', 'social-ad', '1:1', 15, '["#6C5CE7", "#A29BFE"]', 'draft'),
('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'Brand Awareness', 'brand-awareness', '16:9', 60, '["#2D3436", "#636E72"]', 'draft')
ON CONFLICT (id) DO NOTHING;

-- Insert sample nodes
INSERT INTO nodes (id, project_id, type, position, data, config) VALUES 
('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'video', '{"x": 100, "y": 100}', '{"source": "https://example.com/video1.mp4", "trimStart": 0, "trimEnd": 30, "brightness": 100, "contrast": 100}', '{"width": 200, "height": 150, "style": {"backgroundColor": "#f0f0f0", "border": "2px solid #ccc"}}'),
('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'text', '{"x": 400, "y": 100}', '{"content": "Welcome to ViraCut", "font": "Arial", "fontSize": 24, "color": "#333333", "animation": "fade"}', '{"width": 200, "height": 80, "style": {"backgroundColor": "#ffffff", "border": "1px solid #ddd"}}'),
('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'image', '{"x": 100, "y": 200}', '{"source": "https://example.com/image1.jpg"}', '{"width": 180, "height": 180, "style": {"backgroundColor": "#f8f8f8", "borderRadius": "8px"}}')
ON CONFLICT (id) DO NOTHING;

-- Insert sample connections
INSERT INTO connections (id, project_id, source_node_id, target_node_id, source_handle, target_handle) VALUES 
('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'output', 'input')
ON CONFLICT DO NOTHING;

-- Insert sample assets
INSERT INTO assets (id, project_id, user_id, type, name, url, size, metadata) VALUES 
('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'video', 'sample-video.mp4', 'https://example.com/sample-video.mp4', 52428800, '{"duration": 30, "dimensions": {"width": 1920, "height": 1080}, "format": "mp4", "bitrate": 5000, "frameRate": 30}'),
('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'image', 'brand-logo.png', 'https://example.com/brand-logo.png', 1048576, '{"dimensions": {"width": 512, "height": 512}, "format": "png", "colorSpace": "RGB", "hasTransparency": true}'),
('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'audio', 'background-music.mp3', 'https://example.com/background-music.mp3', 4194304, '{"duration": 120, "format": "mp3", "bitrate": 256, "sampleRate": 44100, "channels": 2}')
ON CONFLICT (id) DO NOTHING;

-- Insert sample exports
INSERT INTO exports (id, project_id, settings, status) VALUES 
('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '{"format": "mp4", "resolution": "1080p", "quality": "high", "frameRate": 30, "audioCodec": "aac", "audioBitrate": 128, "videoBitrate": 5000}', 'pending'),
('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '{"format": "mp4", "resolution": "720p", "quality": "medium", "frameRate": 30, "audioCodec": "aac", "audioBitrate": 96, "videoBitrate": 2500}', 'completed')
ON CONFLICT (id) DO NOTHING;

-- Update the completed export with mock completion data
UPDATE exports 
SET url = 'https://example.com/exported-video-2.mp4', 
    size = 20971520, 
    completed_at = NOW() 
WHERE id = '50000000-0000-0000-0000-000000000002';