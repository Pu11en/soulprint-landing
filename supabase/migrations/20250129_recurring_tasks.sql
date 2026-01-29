-- Recurring Tasks for SoulPrint
-- Users can schedule AI to send them updates via email

CREATE TABLE IF NOT EXISTS public.recurring_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Task definition
  task_type TEXT NOT NULL DEFAULT 'custom', -- 'news', 'summary', 'reminder', 'custom'
  prompt TEXT NOT NULL, -- What the AI should do
  description TEXT, -- Human-readable description
  
  -- Schedule (cron-style)
  schedule_hour INTEGER NOT NULL DEFAULT 8, -- 0-23 (user's preferred hour)
  schedule_minute INTEGER DEFAULT 0, -- 0-59
  schedule_days TEXT[] DEFAULT ARRAY['mon','tue','wed','thu','fri','sat','sun'], -- Days to run
  timezone TEXT DEFAULT 'America/Chicago',
  
  -- Delivery
  delivery_method TEXT NOT NULL DEFAULT 'email', -- 'email', 'sms', 'push'
  delivery_email TEXT, -- Override user's email if needed
  
  -- State
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cron queries
CREATE INDEX idx_recurring_tasks_next_run ON public.recurring_tasks(next_run_at) WHERE is_active = true;
CREATE INDEX idx_recurring_tasks_user ON public.recurring_tasks(user_id);

-- RLS
ALTER TABLE public.recurring_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks" ON public.recurring_tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tasks" ON public.recurring_tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks" ON public.recurring_tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks" ON public.recurring_tasks
  FOR DELETE USING (auth.uid() = user_id);

-- Task execution log
CREATE TABLE IF NOT EXISTS public.task_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.recurring_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Execution details
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending', -- 'pending', 'running', 'success', 'failed'
  
  -- Results
  ai_response TEXT,
  delivery_status TEXT, -- 'sent', 'failed', 'bounced'
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_runs_task ON public.task_runs(task_id);

-- RLS for task runs
ALTER TABLE public.task_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own task runs" ON public.task_runs
  FOR SELECT USING (auth.uid() = user_id);
