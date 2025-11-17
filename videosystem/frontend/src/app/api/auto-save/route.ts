import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/services/supabase';
import Logger from '@/utils/logger';

interface AutoSaveRequest {
  id: string;
  data: any;
  timestamp: number;
  lastModified?: number;
  clientTimestamp: number;
}

export async function POST(request: NextRequest) {
  try {
    const saveRequest: AutoSaveRequest = await request.json();

    // Validate the request
    if (!saveRequest || typeof saveRequest !== 'object') {
      return NextResponse.json(
        { error: 'Invalid save request data' },
        { status: 400 }
      );
    }

    const { id, data, timestamp, lastModified, clientTimestamp } = saveRequest;

    if (!id || !data) {
      return NextResponse.json(
        { error: 'ID and data are required' },
        { status: 400 }
      );
    }

    // Log the auto-save request
    Logger.info(`Auto-save request received for ${id}`, 'AutoSave', {
      timestamp,
      lastModified,
      clientTimestamp,
      serverTimestamp: Date.now(),
      processingTime: Date.now() - clientTimestamp,
    });

    // Determine the table and operation based on the ID
    let tableName = '';
    let operation = '';

    if (id.startsWith('project_')) {
      tableName = 'projects';
      operation = 'update';
    } else if (id.startsWith('nodes_')) {
      tableName = 'nodes';
      operation = 'upsert'; // Could be multiple nodes
    } else if (id.startsWith('connections_')) {
      tableName = 'connections';
      operation = 'upsert'; // Could be multiple connections
    } else {
      return NextResponse.json(
        { error: 'Invalid save ID format' },
        { status: 400 }
      );
    }

    // Get the record ID (remove prefix)
    const recordId = id.split('_').slice(1).join('_');

    // Check if record exists and when it was last modified
    let shouldUpdate = true;
    if (lastModified) {
      const { data: existingRecord, error } = await supabase
        .from(tableName)
        .select('updated_at')
        .eq('id', recordId)
        .single();

      if (!error && existingRecord) {
        const existingUpdatedAt = new Date(existingRecord.updated_at).getTime();
        shouldUpdate = lastModified > existingUpdatedAt;
      }
    }

    // Only update if the data is newer
    if (!shouldUpdate) {
      Logger.info(`Skipping auto-save for ${id} - data is not newer`, 'AutoSave');
      return NextResponse.json(
        { 
          success: true,
          message: 'Skipped - data is not newer',
          id,
        },
        { status: 200 }
      );
    }

    // Perform the save operation
    let result;
    if (operation === 'update') {
      const { data: updateResult, error } = await supabase
        .from(tableName)
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', recordId)
        .select()
        .single();

      if (error) {
        Logger.error(`Auto-save failed for ${id}`, 'AutoSave', { error });
        return NextResponse.json(
          { error: 'Save operation failed', details: error.message },
          { status: 500 }
        );
      }

      result = updateResult;
    } else if (operation === 'upsert') {
      // For multiple records, we need to handle them individually
      if (Array.isArray(data)) {
        const upsertPromises = data.map(async (record: any) => {
          const { data: upsertResult, error } = await supabase
            .from(tableName)
            .upsert({
              ...record,
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (error) {
            Logger.error(`Auto-save upsert failed for record in ${id}`, 'AutoSave', { error });
            throw error;
          }

          return upsertResult;
        });

        try {
          result = await Promise.all(upsertPromises);
        } catch (error) {
          Logger.error(`Auto-save upsert failed for ${id}`, 'AutoSave', { error });
          return NextResponse.json(
            { error: 'Upsert operation failed', details: (error as Error).message },
            { status: 500 }
          );
        }
      } else {
        const { data: upsertResult, error } = await supabase
          .from(tableName)
          .upsert({
            ...data,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          Logger.error(`Auto-save upsert failed for ${id}`, 'AutoSave', { error });
          return NextResponse.json(
            { error: 'Upsert operation failed', details: error.message },
            { status: 500 }
          );
        }

        result = upsertResult;
      }
    }

    Logger.info(`Auto-save successful for ${id}`, 'AutoSave', {
      recordId,
      operation,
      serverTimestamp: Date.now(),
    });

    return NextResponse.json(
      { 
        success: true,
        message: 'Auto-save successful',
        id,
        data: result,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    Logger.error('Auto-save API error', 'AutoSave', { error });
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { 
      message: 'Auto-save endpoint',
      status: 'active'
    },
    { status: 200 }
  );
}