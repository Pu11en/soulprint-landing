import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { sendEmail, formatTaskEmail } from '@/lib/email';
import { searchWeb, SearchResult } from '@/lib/search/tavily';

// This runs via Vercel Cron - check every 15 minutes
// vercel.json: { "crons": [{ "path": "/api/cron/tasks", "schedule": "*/15 * * * *" }] }

// Lazy initialization to avoid build-time errors
let _supabaseAdmin: SupabaseClient | null = null;
function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabaseAdmin;
}

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

interface PerplexityCitation {
  url: string;
  title?: string;
}

interface PerplexityResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  citations?: string[] | PerplexityCitation[];
}

/**
 * Query Perplexity's Sonar model for real-time research
 */
async function queryPerplexity(query: string): Promise<{ content: string; citations: string[]; error?: string }> {
  if (!PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY not configured');
  }

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful research assistant. Provide concise, well-organized summaries with the most important and recent information. Use bullet points for clarity.',
        },
        {
          role: 'user',
          content: query,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
  }

  const data: PerplexityResponse = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  // Extract citations - handle both string[] and object[] formats
  const citations: string[] = (data.citations || []).map((c: string | PerplexityCitation) => 
    typeof c === 'string' ? c : c.url
  );

  return { content, citations };
}

/**
 * Format Perplexity response into styled HTML for email
 */
function formatPerplexityForEmail(content: string, citations: string[]): string {
  // Convert markdown-style content to HTML
  let html = content
    // Convert headers
    .replace(/^### (.+)$/gm, '<h4 style="color: #1f2937; margin: 16px 0 8px 0;">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="color: #1f2937; margin: 16px 0 8px 0;">$1</h3>')
    // Convert bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Convert bullet points
    .replace(/^[•\-\*] (.+)$/gm, '<li style="margin: 4px 0;">$1</li>')
    // Wrap consecutive list items
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul style="margin: 12px 0; padding-left: 20px;">$&</ul>')
    // Convert newlines to paragraphs (for non-list content)
    .replace(/\n\n/g, '</p><p style="margin: 12px 0;">')
    // Clean up
    .replace(/\n/g, '<br>');

  // Wrap in container
  html = `<div style="background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0;">
    <p style="margin: 12px 0;">${html}</p>
  </div>`;

  // Add citations if available
  if (citations.length > 0) {
    html += `
      <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px; font-weight: 600; margin-bottom: 8px;">SOURCES</p>
        <ul style="margin: 0; padding-left: 16px; font-size: 13px;">
          ${citations.slice(0, 5).map(url => {
            try {
              const hostname = new URL(url).hostname.replace('www.', '');
              return `<li style="margin: 4px 0;"><a href="${url}" style="color: #2563eb; text-decoration: none;">${hostname}</a></li>`;
            } catch {
              return `<li style="margin: 4px 0;"><a href="${url}" style="color: #2563eb; text-decoration: none;">${url}</a></li>`;
            }
          }).join('')}
        </ul>
      </div>`;
  }

  return html;
}

/**
 * Format Tavily search results into a nice HTML email section (fallback)
 */
function formatTavilyForEmail(results: SearchResult[], answer?: string): string {
  if (!results.length) {
    return '<p>No recent news found. Check back later!</p>';
  }

  let html = '';
  
  if (answer) {
    html += `<div style="background: #f0f9ff; padding: 16px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">
      <p style="margin: 0; font-style: italic; color: #1e40af;">${answer}</p>
    </div>`;
  }

  html += '<div style="margin-top: 16px;">';
  
  for (const result of results) {
    html += `
      <div style="margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb;">
        <a href="${result.url}" style="color: #2563eb; text-decoration: none; font-weight: 600; font-size: 16px;">
          ${result.title}
        </a>
        <p style="color: #4b5563; margin: 8px 0 4px 0; font-size: 14px; line-height: 1.5;">
          ${result.content.slice(0, 300)}${result.content.length > 300 ? '...' : ''}
        </p>
        <span style="color: #9ca3af; font-size: 12px;">${new URL(result.url).hostname}</span>
      </div>
    `;
  }
  
  html += '</div>';
  return html;
}

/**
 * Fetch real-time AI news using Perplexity (primary) or Tavily (fallback)
 */
async function fetchAINews(): Promise<{ content: string; error?: string }> {
  // Try Perplexity first (better for news summaries)
  if (PERPLEXITY_API_KEY) {
    try {
      const { content, citations } = await queryPerplexity(
        'What are the most important AI and artificial intelligence news stories from today and this week? Include major announcements, product launches, research breakthroughs, and industry developments.'
      );
      
      const formattedHtml = formatPerplexityForEmail(content, citations);
      return { content: formattedHtml };
    } catch (error) {
      console.error('[Cron] Perplexity failed, falling back to Tavily:', error);
    }
  }

  // Fallback to Tavily
  try {
    const response = await searchWeb('latest AI artificial intelligence news today', {
      maxResults: 5,
      searchDepth: 'advanced',
      includeAnswer: true,
    });
    
    const formattedHtml = formatTavilyForEmail(response.results, response.answer);
    return { content: formattedHtml };
  } catch (error) {
    console.error('[Cron] Failed to fetch AI news:', error);
    return { 
      content: '<p>Unable to fetch latest news at this time. We\'ll try again next time!</p>',
      error: String(error),
    };
  }
}

/**
 * Fetch content based on a custom prompt using Perplexity (primary) or Tavily (fallback)
 */
async function fetchCustomContent(prompt: string): Promise<{ content: string; error?: string }> {
  // Clean up the prompt for search
  const searchQuery = prompt
    .replace(/^(remind me to|send me|tell me about|update me on)/i, '')
    .trim();

  // Try Perplexity first
  if (PERPLEXITY_API_KEY) {
    try {
      const { content, citations } = await queryPerplexity(searchQuery);
      const formattedHtml = formatPerplexityForEmail(content, citations);
      return { content: formattedHtml };
    } catch (error) {
      console.error('[Cron] Perplexity failed for custom content, falling back to Tavily:', error);
    }
  }

  // Fallback to Tavily
  try {
    const response = await searchWeb(searchQuery, {
      maxResults: 5,
      searchDepth: 'basic',
      includeAnswer: true,
    });
    
    if (!response.results.length) {
      return {
        content: `<p>I searched for "<em>${searchQuery}</em>" but didn't find any specific results.</p>
          <p>Here's your original request: <strong>${prompt}</strong></p>
          <p>Reply to this email if you'd like me to try a different approach!</p>`,
      };
    }
    
    let html = `<p style="margin-bottom: 16px;">Here's what I found for: <strong>${searchQuery}</strong></p>`;
    html += formatTavilyForEmail(response.results, response.answer);
    
    return { content: html };
  } catch (error) {
    console.error('[Cron] Failed to fetch custom content:', error);
    return {
      content: `<p>I tried to look up: "<em>${prompt}</em>" but ran into an issue.</p>
        <p>I'll try again next time! Reply to this email if you want to chat about it now.</p>`,
      error: String(error),
    };
  }
}

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
    const { data: dueTasks, error: fetchError } = await getSupabaseAdmin()
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
        const { data: profile } = await getSupabaseAdmin()
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
        const { data: taskRun } = await getSupabaseAdmin()
          .from('task_runs')
          .insert({
            task_id: task.id,
            user_id: task.user_id,
            status: 'running',
          })
          .select()
          .single();
        
        // Fetch REAL content based on task type
        let aiResponse = '';
        let fetchError: string | undefined;
        
        if (task.task_type === 'news') {
          // Fetch real-time AI news using Tavily
          const newsResult = await fetchAINews();
          aiResponse = newsResult.content;
          fetchError = newsResult.error;
        } else {
          // Custom task - search based on the prompt
          const customResult = await fetchCustomContent(task.prompt);
          aiResponse = customResult.content;
          fetchError = customResult.error;
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
        await getSupabaseAdmin()
          .from('task_runs')
          .update({
            completed_at: new Date().toISOString(),
            status: emailResult.success ? 'success' : 'failed',
            ai_response: aiResponse,
            delivery_status: emailResult.success ? 'sent' : 'failed',
            error_message: emailResult.error || fetchError,
          })
          .eq('id', taskRun?.id);
        
        // Calculate next run time (tomorrow at same time)
        const nextRun = new Date(task.next_run_at);
        nextRun.setDate(nextRun.getDate() + 1);
        
        // Update task
        await getSupabaseAdmin()
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
