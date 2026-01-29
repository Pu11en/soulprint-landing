/**
 * Branch API - Handles file versioning for user edits
 * 
 * POST /api/branch - Create a branch or write to existing branch
 * GET /api/branch - List branches (optionally filtered by user)
 * GET /api/branch?id=xxx - Get specific branch
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import BranchManager from '@/lib/versioning/branch-manager';

const branchManager = new BranchManager({
  projectRoot: process.cwd(),
  branchesDir: 'branches',
});

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, filePath, content, branchId, files, description } = body;

    // Get username from user metadata or email
    const username = user.user_metadata?.name || user.email?.split('@')[0] || user.id;

    switch (action) {
      case 'create': {
        // Create a new branch with specified files
        const branch = await branchManager.createBranch(
          username,
          files || [],
          description
        );
        return NextResponse.json({ branch });
      }

      case 'write': {
        // Write to a file (creates branch if needed)
        if (!filePath || content === undefined) {
          return NextResponse.json(
            { error: 'filePath and content required' },
            { status: 400 }
          );
        }
        const result = await branchManager.writeToFile(
          username,
          filePath,
          content,
          branchId
        );
        return NextResponse.json({ success: true, ...result });
      }

      case 'read': {
        // Read from a branch
        if (!branchId || !filePath) {
          return NextResponse.json(
            { error: 'branchId and filePath required' },
            { status: 400 }
          );
        }
        const fileContent = await branchManager.readBranchFile(branchId, filePath);
        return NextResponse.json({ content: fileContent });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: create, write, read' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Branch API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('id');
    const username = searchParams.get('user');

    if (branchId) {
      // Get specific branch
      const branch = await branchManager.getBranch(branchId);
      if (!branch) {
        return NextResponse.json(
          { error: 'Branch not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ branch });
    }

    if (username) {
      // Get branches for user
      const branches = await branchManager.getUserBranches(username);
      return NextResponse.json({ branches });
    }

    // List all branches
    const branches = await branchManager.listBranches();
    return NextResponse.json({ branches });
  } catch (error) {
    console.error('Branch API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
