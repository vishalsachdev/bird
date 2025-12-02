export interface SweetisticsClientOptions {
  baseUrl: string;
  apiKey: string;
  userAgent?: string;
}

export interface SweetisticsTweetResult {
  success: boolean;
  tweetId?: string;
  error?: string;
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'https://sweetistics.com';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

export class SweetisticsClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly userAgent?: string;

  constructor(options: SweetisticsClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.apiKey = options.apiKey.trim();
    this.userAgent = options.userAgent;
    if (!this.apiKey) {
      throw new Error('Sweetistics API key is required');
    }
  }

  async tweet(text: string, replyToTweetId?: string): Promise<SweetisticsTweetResult> {
    const payload: Record<string, unknown> = { text };
    if (replyToTweetId) {
      payload.replyToTweetId = replyToTweetId;
    }

    const response = await fetch(`${this.baseUrl}/api/actions/tweet`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
        ...(this.userAgent ? { 'user-agent': this.userAgent } : {}),
      },
      body: JSON.stringify(payload),
    });

    let data: unknown;
    try {
      data = await response.json();
    } catch (error) {
      return {
        success: false,
        error: `Sweetistics response parse failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    const success = typeof (data as { success?: unknown })?.success === 'boolean' ? (data as { success: boolean }).success : false;
    const tweetId = typeof (data as { tweetId?: unknown })?.tweetId === 'string' ? (data as { tweetId?: string }).tweetId : undefined;
    const errorMessage = typeof (data as { error?: unknown })?.error === 'string' ? (data as { error?: string }).error : undefined;

    if (!response.ok || !success) {
      const reason = errorMessage || `HTTP ${response.status}`;
      return { success: false, error: reason };
    }

    return { success: true, tweetId };
  }
}
