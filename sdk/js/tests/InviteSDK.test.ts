import {ShareInstallsSDK} from '../src/InviteSDK';
import {ApiClient} from '../src/ApiClient';
import {FingerprintCollector} from '../src/FingerprintCollector';

jest.mock('../src/ApiClient');
// No global mock to avoid side effects on other test files
// jest.mock('../src/FingerprintCollector');

describe('ShareInstallsSDK', () => {
  const options = {
    apiBaseUrl: 'https://api.example.com',
    apiKey: 'test_key',
    debug: true,
  };
  let sdk: ShareInstallsSDK;

  beforeEach(() => {
    jest.clearAllMocks();
    sdk = new ShareInstallsSDK(options);
  });

  it('initializes ApiClient with correct params', () => {
    expect(ApiClient).toHaveBeenCalledWith(
      options.apiBaseUrl,
      options.apiKey,
      true
    );
  });

  it('trackClick collects fingerprint and calls ApiClient.post', async () => {
    const mockFingerprint = {ua: 'test-ua', languages: ['en']};
    const collectSpy = jest.spyOn(FingerprintCollector, 'collect').mockResolvedValue(mockFingerprint as any);
    
    const mockResponse = {clickEventId: '123'};
    (ApiClient.prototype.post as jest.Mock).mockResolvedValue(mockResponse);

    const result = await sdk.trackClick('INVITE123');

    expect(collectSpy).toHaveBeenCalled();
    expect(ApiClient.prototype.post).toHaveBeenCalledWith(
      '/v1/clicks',
      expect.objectContaining({
        inviteCode: 'INVITE123',
        fingerprint: mockFingerprint,
      }),
      5000
    );
    expect(result).toEqual(mockResponse);
    collectSpy.mockRestore();
  });

  it('trackClick throws error if inviteCode is empty', async () => {
    await expect(sdk.trackClick('')).rejects.toThrow('inviteCode must not be empty');
    await expect(sdk.trackClick('  ')).rejects.toThrow('inviteCode must not be empty');
  });

  it('platform detection helpers work', () => {
    const iosSpy = jest.spyOn(FingerprintCollector, 'isIOS').mockReturnValue(true);
    const androidSpy = jest.spyOn(FingerprintCollector, 'isAndroid').mockReturnValue(false);

    expect(sdk.isIOS()).toBe(true);
    expect(sdk.isAndroid()).toBe(false);
    expect(sdk.isMobile()).toBe(true);
    
    iosSpy.mockRestore();
    androidSpy.mockRestore();
  });
});
