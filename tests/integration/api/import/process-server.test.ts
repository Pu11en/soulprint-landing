import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/import/process-server/route';
import { server } from '@/tests/mocks/server';
import { http, HttpResponse } from 'msw';
import sampleConversations from '@/tests/mocks/fixtures/sample-conversations.json';

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

vi.mock('zlib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('zlib')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      gzipSync: vi.fn((buffer) => Buffer.from('compressed-data')),
    },
    gzipSync: vi.fn((buffer) => Buffer.from('compressed-data')),
  };
});

// Create a mock Blob with arrayBuffer method
const createMockBlob = (data: string) => {
  const buffer = Buffer.from(data, 'utf-8');
  return {
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    size: buffer.length,
    type: 'application/json',
  };
};

// Create mock admin client factory
const createMockAdminClient = () => ({
  from: vi.fn(() => ({
    upsert: vi.fn(() => ({ error: null })),
    update: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
  })),
  storage: {
    from: vi.fn((bucket: string) => ({
      download: vi.fn(() => ({
        data: createMockBlob(JSON.stringify(sampleConversations)),
        error: null,
      })),
      upload: vi.fn(() => ({ data: { path: 'test-path' }, error: null })),
      remove: vi.fn(() => ({ catch: vi.fn() })),
    })),
  },
  auth: {
    admin: {
      getUserById: vi.fn(() => ({
        data: {
          user: {
            email: 'test@example.com',
            user_metadata: { display_name: 'Test User' },
          },
        },
        error: null,
      })),
    },
  },
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => createMockAdminClient()),
}));

describe('POST /api/import/process-server', () => {
  afterEach(() => {
    vi.clearAllMocks();
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

    const request = new Request('http://localhost/api/import/process-server', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storagePath: 'imports/test.json' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error).toBe('Not authenticated');
  });

  it('returns 400 when storagePath missing', async () => {
    const request = new Request('http://localhost/api/import/process-server', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe('storagePath required');
  });

  it('accepts internal server-to-server calls via X-Internal-User-Id header', async () => {
    const request = new Request('http://localhost/api/import/process-server', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-User-Id': 'internal-user-123',
      },
      body: JSON.stringify({ storagePath: 'imports/test.json' }),
    });

    // Add RLM handler for this test
    server.use(
      http.post('https://soulprint-landing.onrender.com/process-full', () => {
        return HttpResponse.json({ success: true });
      })
    );

    const response = await POST(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it('processes valid JSON file successfully', async () => {
    const request = new Request('http://localhost/api/import/process-server', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-User-Id': 'test-user-id',
      },
      body: JSON.stringify({ storagePath: 'imports/test-user-id/test.json' }),
    });

    // Add RLM handler
    server.use(
      http.post('https://soulprint-landing.onrender.com/process-full', () => {
        return HttpResponse.json({ success: true });
      })
    );

    const response = await POST(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.totalConversations).toBeGreaterThan(0);
    expect(body.totalMessages).toBeGreaterThan(0);
    expect(body.status).toBe('processing');
  });

  it('rejects invalid ChatGPT format', async () => {
    // Override storage download to return invalid format for this test
    const { createClient } = await import('@supabase/supabase-js');
    const mockClient = createMockAdminClient();
    mockClient.storage.from = vi.fn(() => ({
      download: vi.fn(() => ({
        data: createMockBlob(JSON.stringify([{ no_mapping: true }])),
        error: null,
      })),
      remove: vi.fn(() => ({ catch: vi.fn() })),
    }));
    vi.mocked(createClient).mockReturnValueOnce(mockClient as any);

    const request = new Request('http://localhost/api/import/process-server', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-User-Id': 'test-user-id',
      },
      body: JSON.stringify({ storagePath: 'imports/test-user-id/invalid.json' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toContain("doesn't look like a ChatGPT export");
  });

  it('handles storage download failure', async () => {
    // Override storage download to return error for this test
    const { createClient } = await import('@supabase/supabase-js');
    const mockClient = createMockAdminClient();
    mockClient.storage.from = vi.fn(() => ({
      download: vi.fn(() => ({
        data: null,
        error: { message: 'File not found' },
      })),
    }));
    vi.mocked(createClient).mockReturnValueOnce(mockClient as any);

    const request = new Request('http://localhost/api/import/process-server', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-User-Id': 'test-user-id',
      },
      body: JSON.stringify({ storagePath: 'imports/test-user-id/missing.json' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toBe('Failed to download file from storage');
  });

  it('fires RLM process-full call', async () => {
    let rlmCalled = false;

    // Track if RLM endpoint was called
    server.use(
      http.post('https://soulprint-landing.onrender.com/process-full', async ({ request }) => {
        rlmCalled = true;
        const body = await request.json() as any;
        expect(body.user_id).toBe('test-user-id');
        expect(body.storage_path).toContain('user-imports/');
        return HttpResponse.json({ success: true });
      })
    );

    const request = new Request('http://localhost/api/import/process-server', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-User-Id': 'test-user-id',
      },
      body: JSON.stringify({ storagePath: 'imports/test-user-id/test.json' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    // Wait a bit for async RLM call
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(rlmCalled).toBe(true);
  });

  it('handles empty conversations array', async () => {
    // Override storage download to return empty array for this test
    const { createClient } = await import('@supabase/supabase-js');
    const mockClient = createMockAdminClient();
    mockClient.storage.from = vi.fn(() => ({
      download: vi.fn(() => ({
        data: createMockBlob(JSON.stringify([])),
        error: null,
      })),
      remove: vi.fn(() => ({ catch: vi.fn() })),
    }));
    vi.mocked(createClient).mockReturnValueOnce(mockClient as any);

    const request = new Request('http://localhost/api/import/process-server', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-User-Id': 'test-user-id',
      },
      body: JSON.stringify({ storagePath: 'imports/test-user-id/empty.json' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toContain('No conversations found');
  });

  it('handles non-array JSON', async () => {
    // Override storage download to return non-array for this test
    const { createClient } = await import('@supabase/supabase-js');
    const mockClient = createMockAdminClient();
    mockClient.storage.from = vi.fn(() => ({
      download: vi.fn(() => ({
        data: createMockBlob(JSON.stringify({ not: 'array' })),
        error: null,
      })),
      remove: vi.fn(() => ({ catch: vi.fn() })),
    }));
    vi.mocked(createClient).mockReturnValueOnce(mockClient as any);

    const request = new Request('http://localhost/api/import/process-server', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-User-Id': 'test-user-id',
      },
      body: JSON.stringify({ storagePath: 'imports/test-user-id/invalid.json' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toContain('Invalid ChatGPT export format');
  });
});
