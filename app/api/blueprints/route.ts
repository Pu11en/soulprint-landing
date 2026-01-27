import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface Blueprint {
  id?: string;
  title: string;
  description?: string;
  category?: string;
  impact_score?: number;
  feasibility_score?: number;
  effort_estimate?: string;
  status?: string;
  source_type?: string;
  source_url?: string;
  source_author?: string;
  source_timestamp?: string;
  tags?: string[];
  notes?: string;
  spec_doc?: string;
}

/**
 * GET /api/blueprints
 * List all blueprints, sorted by priority
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const category = searchParams.get('category');
  const limit = parseInt(searchParams.get('limit') || '50');

  let query = supabaseAdmin
    .from('blueprints')
    .select('*')
    .order('priority_score', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (status) {
    query = query.eq('status', status);
  }
  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ blueprints: data });
}

/**
 * POST /api/blueprints
 * Create a new blueprint
 */
export async function POST(request: NextRequest) {
  try {
    const body: Blueprint | Blueprint[] = await request.json();
    
    // Handle both single and batch inserts
    const blueprints = Array.isArray(body) ? body : [body];

    const { data, error } = await supabaseAdmin
      .from('blueprints')
      .insert(blueprints)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      blueprints: data,
      count: data.length 
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * PATCH /api/blueprints
 * Update a blueprint by ID
 */
export async function PATCH(request: NextRequest) {
  try {
    const { id, ...updates } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Blueprint ID required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('blueprints')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, blueprint: data });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
