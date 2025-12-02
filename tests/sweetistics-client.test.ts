import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SweetisticsClient } from '../src/lib/sweetistics-client.js';

describe('SweetisticsClient', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('posts tweet with bearer token and reply id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, tweetId: '123' }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new SweetisticsClient({ baseUrl: 'https://api.example.com', apiKey: 'sweet-test' });
    const result = await client.tweet('hello world', '456');

    expect(result.success).toBe(true);
    expect(result.tweetId).toBe('123');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.com/api/actions/tweet');
    expect((init as RequestInit).headers).toMatchObject({ authorization: 'Bearer sweet-test' });
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ text: 'hello world', replyToTweetId: '456' });
  });

  it('returns error when API responds with failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ success: false, error: 'Unauthorized' }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new SweetisticsClient({ baseUrl: 'https://api.example.com', apiKey: 'sweet-test' });
    const result = await client.tweet('test');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unauthorized');
  });
});
