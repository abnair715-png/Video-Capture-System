import {
  getRetryDelayMs,
  isVideoRetryDue,
  MAX_RETRY_COUNT,
} from '../src/services/retryPolicy';

describe('retryPolicy', () => {
  it('returns the expected exponential backoff delays', () => {
    expect(getRetryDelayMs(0)).toBe(0);
    expect(getRetryDelayMs(1)).toBe(2000);
    expect(getRetryDelayMs(2)).toBe(4000);
    expect(getRetryDelayMs(3)).toBe(8000);
    expect(getRetryDelayMs(4)).toBe(16000);
    expect(getRetryDelayMs(5)).toBe(32000);
    expect(getRetryDelayMs(6)).toBe(64000);
  });

  it('detects when a pending retry is due', () => {
    const now = Date.now();

    expect(
      isVideoRetryDue(
        {
          attempt_count: 0,
          last_attempted_at: '',
          upload_state: 'pending',
        },
        now,
      ),
    ).toBe(true);

    expect(
      isVideoRetryDue(
        {
          attempt_count: 1,
          last_attempted_at: new Date(now - 1500).toISOString(),
          upload_state: 'pending',
        },
        now,
      ),
    ).toBe(false);

    expect(
      isVideoRetryDue(
        {
          attempt_count: 1,
          last_attempted_at: new Date(now - 2500).toISOString(),
          upload_state: 'pending',
        },
        now,
      ),
    ).toBe(true);
  });

  it('caps retries at the maximum retry count', () => {
    expect(MAX_RETRY_COUNT).toBe(6);
    expect(
      isVideoRetryDue(
        {
          attempt_count: 7,
          last_attempted_at: new Date().toISOString(),
          upload_state: 'pending',
        },
        Date.now(),
      ),
    ).toBe(false);
  });
});
