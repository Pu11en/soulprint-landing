import { NextRequest, NextResponse } from 'next/server';
import Logger from '@/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const errorReport = await request.json();

    // Validate the error report
    if (!errorReport || typeof errorReport !== 'object') {
      return NextResponse.json(
        { error: 'Invalid error report data' },
        { status: 400 }
      );
    }

    // Log the error report
    Logger.error('Error report received', 'ErrorReporting', errorReport);

    // In a real implementation, you would send this to an error tracking service
    // like Sentry, Bugsnag, LogRocket, etc.
    // For now, we'll just log it
    
    // In production, you might want to:
    // 1. Send to Sentry
    // 2. Store in a database table
    // 3. Send to a logging service
    // 4. Create alerts for critical errors
    
    return NextResponse.json(
      { 
        success: true,
        message: 'Error report received',
        id: `error_${Date.now()}` // Generate a unique ID
      },
      { status: 200 }
    );
  } catch (error) {
    Logger.error('Error processing error report', 'ErrorReporting', { error });
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { 
      message: 'Error reporting endpoint',
      status: 'active'
    },
    { status: 200 }
  );
}