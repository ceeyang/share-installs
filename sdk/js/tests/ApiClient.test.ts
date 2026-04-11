import {ApiClient} from '../src/ApiClient';
import {ShareInstallsError} from '../src/types';

describe('ApiClient', () => {
  const baseUrl = 'https://api.example.com';
  const apiKey = 'test_key';
  let client: ApiClient;

  const originalFetch = global.fetch;

  beforeEach(() => {
    client = new ApiClient(baseUrl, apiKey);
    // Mock global fetch
    global.fetch = jest.fn();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  it('formats baseUrl correctly (strips trailing slash)', () => {
    const clientWithSlash = new ApiClient('https://example.com/');
    expect((clientWithSlash as any).baseUrl).toBe('https://example.com');
  });

  it('sends correct headers, including Authorization', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({success: true}),
    });

    await client.post('/test', {foo: 'bar'}, 5000);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/test',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-SDK-Platform': 'js',
          'X-SDK-Version': '1.0.0',
          Authorization: 'Bearer test_key',
        },
        body: JSON.stringify({foo: 'bar'}),
      }),
    );
  });

  it('throws ShareInstallsError on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({error: {message: 'Bad Request', status: 'INVALID_ARGUMENT'}}),
    });

    try {
      await client.get('/bad', 5000);
      fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ShareInstallsError);
      expect(err.message).toBe('Bad Request');
      expect(err.statusCode).toBe(400);
      expect(err.errorCode).toBe('INVALID_ARGUMENT');
    }
  });

  it('handles timeout correctly', async () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {})); // Never resolves

    const promise = client.get('/timeout', 100);
    
    // Advance timers
    jest.advanceTimersByTime(150);

    await expect(promise).rejects.toThrow('Request timed out');
  });

  it('handles network error', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Failed to fetch'));

    await expect(client.get('/fail', 5000)).rejects.toThrow('Network error: Failed to fetch');
  });
});
