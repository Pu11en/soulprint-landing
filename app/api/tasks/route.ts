import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - List user's tasks
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { data: tasks, error } = await supabase
      .from('recurring_tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return NextResponse.json({ tasks: tasks || [] });
  } catch (error) {
    console.error('Failed to fetch tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

// POST - Create new task
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await req.json();
    const {
      prompt,
      description,
      task_type = 'custom',
      schedule_hour = 8,
      schedule_minute = 0,
      schedule_days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      timezone = 'America/Chicago',
    } = body;
    
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }
    
    // Calculate next run time
    const now = new Date();
    const nextRun = new Date();
    nextRun.setHours(schedule_hour, schedule_minute, 0, 0);
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    
    const { data: task, error } = await supabase
      .from('recurring_tasks')
      .insert({
        user_id: user.id,
        prompt,
        description: description || prompt.slice(0, 50),
        task_type,
        schedule_hour,
        schedule_minute,
        schedule_days,
        timezone,
        delivery_email: user.email,
        next_run_at: nextRun.toISOString(),
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({ task, message: 'Task created!' });
  } catch (error) {
    console.error('Failed to create task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

// DELETE - Delete a task
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('id');
    
    if (!taskId) {
      return NextResponse.json({ error: 'Task ID required' }, { status: 400 });
    }
    
    const { error } = await supabase
      .from('recurring_tasks')
      .delete()
      .eq('id', taskId)
      .eq('user_id', user.id);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete task:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
