import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, formatTaskEmail } from '@/lib/email';

// This runs via Vercel Cron - check every 15 minutes
// vercel.json: { "crons": [{ "path": "/api/cron/tasks", "schedule": "*/15 * * * *" }] }

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  // Verify cron secret (optional but recommended)
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Allow in development or if no secret set
    if (process.env.NODE_ENV === 'production' && process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  
  const now = new Date();
  const results: { taskId: string; status: string; error?: string }[] = [];
  
  try {
    // Find tasks due to run
    const { data: dueTasks, error: fetchError } = await supabaseAdmin
      .from('recurring_tasks')
      .select('*, user:user_id(email)')
      .eq('is_active', true)
      .lte('next_run_at', now.toISOString())
      .limit(10); // Process max 10 per run to avoid timeout
    
    if (fetchError) throw fetchError;
    
    if (!dueTasks || dueTasks.length === 0) {
      return NextResponse.json({ message: 'No tasks due', processed: 0 });
    }
    
    for (const task of dueTasks) {
      try {
        // Get user's AI name
        const { data: profile } = await supabaseAdmin
          .from('user_profiles')
          .select('ai_name')
          .eq('id', task.user_id)
          .single();
        
        const aiName = profile?.ai_name || 'SoulPrint';
        const userEmail = task.delivery_email || (task.user as { email: string })?.email;
        
        if (!userEmail) {
          results.push({ taskId: task.id, status: 'failed', error: 'No email' });
          continue;
        }
        
        // Create task run record
        const { data: taskRun } = await supabaseAdmin
          .from('task_runs')
          .insert({
            task_id: task.id,
            user_id: task.user_id,
            status: 'running',
          })
          .select()
          .single();
        
        // Generate AI response for the task
        // For now, use a simple template - later integrate with actual AI
        let aiResponse = '';
        
        if (task.task_type === 'news') {
          // AI News summary - could call an API here
          aiResponse = `Here's your AI news update:\n\n• OpenAI announced new features for ChatGPT\n• Google released updates to Gemini\n• Meta expanded AI capabilities\n\nWant me to dive deeper into any of these?`;
        } else {
          // Custom task - echo the prompt with AI flavor
          aiResponse = `You asked me to: "${task.prompt}"\n\nI'm working on making this smarter! For now, this is your reminder. Reply to chat with me about it.`;
        }
        
        // Format and send email
        const { subject, html } = formatTaskEmail({
          aiName,
          taskDescription: task.description || task.prompt.slice(0, 50),
          aiResponse,
        });
        
        const emailResult = await sendEmail({
          to: userEmail,
          subject,
          html,
        });
        
        // Update task run
        await supabaseAdmin
          .from('task_runs')
          .update({
            completed_at: new Date().toISOString(),
            status: emailResult.success ? 'success' : 'failed',
            ai_response: aiResponse,
            delivery_status: emailResult.success ? 'sent' : 'failed',
            error_message: emailResult.error,
          })
          .eq('id', taskRun?.id);
        
        // Calculate next run time (tomorrow at same time)
        const nextRun = new Date(task.next_run_at);
        nextRun.setDate(nextRun.getDate() + 1);
        
        // Update task
        await supabaseAdmin
          .from('recurring_tasks')
          .update({
            last_run_at: now.toISOString(),
            next_run_at: nextRun.toISOString(),
            run_count: (task.run_count || 0) + 1,
          })
          .eq('id', task.id);
        
        results.push({ 
          taskId: task.id, 
          status: emailResult.success ? 'success' : 'failed',
          error: emailResult.error,
        });
        
      } catch (taskError) {
        console.error(`Task ${task.id} failed:`, taskError);
        results.push({ taskId: task.id, status: 'failed', error: String(taskError) });
      }
    }
    
    return NextResponse.json({
      message: 'Cron completed',
      processed: results.length,
      results,
    });
    
  } catch (error) {
    console.error('Cron failed:', error);
    return NextResponse.json({ error: 'Cron failed', details: String(error) }, { status: 500 });
  }
}
