/**
 * Test R2 connectivity step by step
 */

import { NextResponse } from 'next/server';
import { S3Client, ListObjectsV2Command, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const runtime = 'nodejs';

export async function GET() {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    steps: {},
  };

  // Check env vars
  results.steps.envVars = {
    R2_ENDPOINT: process.env.R2_ENDPOINT ? '✓ set' : '✗ missing',
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID ? '✓ set' : '✗ missing',
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY ? '✓ set' : '✗ missing',
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME ? '✓ set' : '✗ missing',
  };

  if (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID || 
      !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET_NAME) {
    results.error = 'Missing R2 environment variables';
    return NextResponse.json(results);
  }

  // Create R2 client
  let R2: S3Client;
  try {
    R2 = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
    results.steps.clientCreated = '✓ S3Client created';
  } catch (e) {
    results.steps.clientCreated = `✗ Failed: ${e instanceof Error ? e.message : 'Unknown'}`;
    return NextResponse.json(results);
  }

  // Test 1: List objects (tests basic connectivity)
  try {
    const listCmd = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
      MaxKeys: 1,
    });
    const listResult = await R2.send(listCmd);
    results.steps.listObjects = `✓ Can list bucket (${listResult.KeyCount || 0} objects found)`;
  } catch (e) {
    results.steps.listObjects = `✗ Failed: ${e instanceof Error ? e.message : 'Unknown'}`;
    return NextResponse.json(results);
  }

  // Test 2: Upload a small test file
  const testKey = `test/connectivity-test-${Date.now()}.txt`;
  try {
    const putCmd = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: testKey,
      Body: 'Hello from SoulPrint test!',
      ContentType: 'text/plain',
    });
    await R2.send(putCmd);
    results.steps.uploadTest = '✓ Can upload to bucket';
  } catch (e) {
    results.steps.uploadTest = `✗ Failed: ${e instanceof Error ? e.message : 'Unknown'}`;
    return NextResponse.json(results);
  }

  // Test 3: Generate signed URL
  try {
    const getCmd = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: testKey,
    });
    const signedUrl = await getSignedUrl(R2, getCmd, { expiresIn: 60 });
    results.steps.signedUrl = `✓ Can generate signed URL`;
    results.steps.signedUrlSample = signedUrl.substring(0, 100) + '...';
  } catch (e) {
    results.steps.signedUrl = `✗ Failed: ${e instanceof Error ? e.message : 'Unknown'}`;
  }

  // Test 4: Download the test file
  try {
    const getCmd = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: testKey,
    });
    const getResult = await R2.send(getCmd);
    const body = await getResult.Body?.transformToString();
    results.steps.downloadTest = `✓ Can download from bucket (content: "${body}")`;
  } catch (e) {
    results.steps.downloadTest = `✗ Failed: ${e instanceof Error ? e.message : 'Unknown'}`;
  }

  // Test 5: Clean up - delete test file
  try {
    const deleteCmd = new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: testKey,
    });
    await R2.send(deleteCmd);
    results.steps.deleteTest = '✓ Can delete from bucket';
  } catch (e) {
    results.steps.deleteTest = `✗ Failed: ${e instanceof Error ? e.message : 'Unknown'}`;
  }

  results.success = true;
  results.summary = 'All R2 tests passed!';

  return NextResponse.json(results);
}
