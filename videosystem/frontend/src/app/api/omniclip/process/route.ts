import { NextRequest, NextResponse } from 'next/server';
import { omniclipService, ProcessingOptions } from '@/services/omniclip';
import logger from '@/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, videoUrl, options } = body;

    if (!projectId || !videoUrl) {
      return NextResponse.json(
        { error: 'Missing required parameters: projectId and videoUrl' },
        { status: 400 }
      );
    }

    logger.info(`Processing video via API: ${videoUrl}`, JSON.stringify({
      projectId,
      videoUrl,
      options
    }));

    const result = await omniclipService.processVideo(projectId, videoUrl, options);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: result.result,
    });
  } catch (error) {
    logger.error(`Error in Omniclip process API: ${error instanceof Error ? error.message : String(error)}`);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}