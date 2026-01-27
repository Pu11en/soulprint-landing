import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not available' }, { status: 404 });
    }

    // Check which environment variables are actually set
    const envStatus = {
        // Supabase
        NEXT_PUBLIC_SUPABASE_URL: {
            configured: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            value: process.env.NEXT_PUBLIC_SUPABASE_URL ? 
                process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 20) + '...' : 'missing'
        },
        NEXT_PUBLIC_SUPABASE_ANON_KEY: {
            configured: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 
                'present (' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length + ' chars)' : 'missing'
        },
        SUPABASE_SERVICE_ROLE_KEY: {
            configured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            value: process.env.SUPABASE_SERVICE_ROLE_KEY ? 
                'present (' + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ' chars)' : 'missing'
        },
        
        // AWS
        AWS_ACCESS_KEY_ID: {
            configured: !!process.env.AWS_ACCESS_KEY_ID,
            value: process.env.AWS_ACCESS_KEY_ID ? 
                'present (' + process.env.AWS_ACCESS_KEY_ID.length + ' chars)' : 'missing'
        },
        AWS_SECRET_ACCESS_KEY: {
            configured: !!process.env.AWS_SECRET_ACCESS_KEY,
            value: process.env.AWS_SECRET_ACCESS_KEY ? 
                'present (' + process.env.AWS_SECRET_ACCESS_KEY.length + ' chars)' : 'missing'
        },
        AWS_REGION: {
            configured: !!process.env.AWS_REGION,
            value: process.env.AWS_REGION || 'missing'
        },
        BEDROCK_MODEL_ID: {
            configured: !!process.env.BEDROCK_MODEL_ID,
            value: process.env.BEDROCK_MODEL_ID || 'missing'
        },
        
        // AssemblyAI
        ASSEMBLYAI_API_KEY: {
            configured: !!process.env.ASSEMBLYAI_API_KEY,
            value: process.env.ASSEMBLYAI_API_KEY ? 
                'present (' + process.env.ASSEMBLYAI_API_KEY.length + ' chars)' : 'missing'
        },
        
        // Environment
        NODE_ENV: process.env.NODE_ENV || 'unknown',
        VERCEL: process.env.VERCEL || 'false',
        VERCEL_ENV: process.env.VERCEL_ENV || 'unknown',
        
        // Other
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'missing'
    };

    // Test actual connections
    const results = {
        environment: envStatus,
        timestamp: new Date().toISOString(),
        deployment_id: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown'
    };

    return NextResponse.json(results, {
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
    });
}