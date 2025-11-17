import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';
import logger from '@/utils/logger';

export async function POST(request: NextRequest) {
  try {
    // Get the form data from the request
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const path = formData.get('path') as string;
    const bucket = formData.get('bucket') as string || 'assets';
    const upsert = formData.get('upsert') === 'true';
    const cacheControl = formData.get('cacheControl') as string || '3600';
    const metadataStr = formData.get('metadata') as string;
    
    let metadata = {};
    if (metadataStr) {
      try {
        metadata = JSON.parse(metadataStr);
      } catch (error) {
        logger.warn(`Failed to parse metadata JSON: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!path) {
      return NextResponse.json(
        { error: 'No path provided' },
        { status: 400 }
      );
    }

    logger.info(`Uploading file via API: ${file.name}`, JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      path,
      bucket,
      upsert
    }));

    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        upsert,
        cacheControl,
        metadata,
        contentType: file.type,
      });

    if (error) {
      logger.error(`Failed to upload file: ${error.message}`);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Get public URL if bucket is public
    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    logger.info(`File uploaded successfully via API: ${data.path}`, JSON.stringify({
      path: data.path,
      publicUrl: publicUrlData.publicUrl
    }));

    return NextResponse.json({
      data: {
        path: data.path,
        publicUrl: publicUrlData.publicUrl,
      },
    });
  } catch (error) {
    logger.error(`Error in upload API: ${error instanceof Error ? error.message : String(error)}`);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}