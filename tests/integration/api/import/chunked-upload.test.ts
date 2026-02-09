import { describe, it, expect, vi, afterEach } from 'vitest';
import { POST } from '@/app/api/import/chunked-upload/route';
import { NextRequest } from 'next/server';

// Store uploaded chunks for assembly verification
const storedChunks = new Map<string, Buffer>();

const mockUpload = vi.fn(async (path: string, data: Buffer | Uint8Array) => {
  storedChunks.set(path, Buffer.from(data));
  return { data: { path }, error: null };
});

const mockDownload = vi.fn(async (path: string) => {
  const buf = storedChunks.get(path);
  if (!buf) return { data: null, error: { message: 'Not found' } };
  const blob = new Blob([new Uint8Array(buf)]);
  return { data: blob, error: null };
});

const mockRemove = vi.fn(async () => ({ data: null, error: null }));

// Mock modules
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => ({
        data: { user: { id: 'test-user-id' } },
        error: null,
      })),
    },
  })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: mockUpload,
        download: mockDownload,
        remove: mockRemove,
      })),
    },
  })),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => null),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    child: vi.fn(() => ({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

describe('POST /api/import/chunked-upload', () => {
  afterEach(() => {
    vi.clearAllMocks();
    storedChunks.clear();
  });

  it('returns 401 when not authenticated', async () => {
    // Override auth mock to return no user
    const { createClient } = await import('@/lib/supabase/server');
    vi.mocked(createClient).mockReturnValueOnce({
      auth: {
        getUser: vi.fn(() => ({
          data: { user: null },
          error: { message: 'Not authenticated' },
        })),
      },
    } as any);

    const request = new NextRequest('http://localhost/api/import/chunked-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Chunk-Index': '0',
        'X-Total-Chunks': '1',
      },
      body: Buffer.from('test data'),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('accepts single chunk and returns complete', async () => {
    const uploadId = 'test-upload-single';
    const chunkData = Buffer.from('{"test": "data"}');

    const request = new NextRequest('http://localhost/api/import/chunked-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Chunk-Index': '0',
        'X-Total-Chunks': '1',
        'X-Total-Size': String(chunkData.length),
        'X-Upload-Id': uploadId,
      },
      body: chunkData,
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.complete).toBe(true);
    expect(body.path).toBeDefined();
    expect(body.path).toContain('imports/');
    expect(body.size).toBe(chunkData.length);
  });

  it('accumulates multiple chunks', async () => {
    const uploadId = 'test-upload-multi';
    const chunk1 = Buffer.from('part1');
    const chunk2 = Buffer.from('part2');

    // Send chunk 0 of 2
    const request1 = new NextRequest('http://localhost/api/import/chunked-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Chunk-Index': '0',
        'X-Total-Chunks': '2',
        'X-Total-Size': String(chunk1.length + chunk2.length),
        'X-Upload-Id': uploadId,
      },
      body: chunk1,
    });

    const response1 = await POST(request1);
    expect(response1.status).toBe(200);

    const body1 = await response1.json();
    expect(body1.success).toBe(true);
    expect(body1.complete).toBe(false);
    expect(body1.received).toBe(1);
    expect(body1.total).toBe(2);

    // Send chunk 1 of 2
    const request2 = new NextRequest('http://localhost/api/import/chunked-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Chunk-Index': '1',
        'X-Total-Chunks': '2',
        'X-Total-Size': String(chunk1.length + chunk2.length),
        'X-Upload-Id': uploadId,
      },
      body: chunk2,
    });

    const response2 = await POST(request2);
    expect(response2.status).toBe(200);

    const body2 = await response2.json();
    expect(body2.success).toBe(true);
    expect(body2.complete).toBe(true);
    expect(body2.path).toBeDefined();
    expect(body2.size).toBe(chunk1.length + chunk2.length);
  });

  it('handles storage upload error on chunk', async () => {
    // Make the first chunk upload fail
    mockUpload.mockResolvedValueOnce({
      data: null,
      error: { message: 'Storage quota exceeded' },
    } as any);

    const uploadId = 'test-upload-error';
    const chunkData = Buffer.from('test data');

    const request = new NextRequest('http://localhost/api/import/chunked-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Chunk-Index': '0',
        'X-Total-Chunks': '1',
        'X-Upload-Id': uploadId,
      },
      body: chunkData,
    });

    const response = await POST(request);
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toContain('Chunk upload failed');
  });

  it('handles out-of-order chunks', async () => {
    const uploadId = 'test-upload-ooo';
    const chunk1 = Buffer.from('AAA');
    const chunk2 = Buffer.from('BBB');
    const chunk3 = Buffer.from('CCC');

    // Send chunk 2 first (index 2 of 3)
    const request1 = new NextRequest('http://localhost/api/import/chunked-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Chunk-Index': '2',
        'X-Total-Chunks': '3',
        'X-Upload-Id': uploadId,
      },
      body: chunk3,
    });

    const response1 = await POST(request1);
    expect(response1.status).toBe(200);
    const body1 = await response1.json();
    expect(body1.complete).toBe(false);
    expect(body1.received).toBe(1);

    // Send chunk 0 (index 0 of 3)
    const request2 = new NextRequest('http://localhost/api/import/chunked-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Chunk-Index': '0',
        'X-Total-Chunks': '3',
        'X-Upload-Id': uploadId,
      },
      body: chunk1,
    });

    const response2 = await POST(request2);
    expect(response2.status).toBe(200);
    const body2 = await response2.json();
    expect(body2.complete).toBe(false);
    expect(body2.received).toBe(2);

    // Send final chunk (index 1 of 3)
    const request3 = new NextRequest('http://localhost/api/import/chunked-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Chunk-Index': '1',
        'X-Total-Chunks': '3',
        'X-Upload-Id': uploadId,
      },
      body: chunk2,
    });

    const response3 = await POST(request3);
    expect(response3.status).toBe(200);
    const body3 = await response3.json();
    expect(body3.complete).toBe(true);
    // Combined size should be AAA + BBB + CCC
    expect(body3.size).toBe(9);
  });
});
