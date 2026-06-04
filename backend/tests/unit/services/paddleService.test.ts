import {paddleService} from '../../../src/services/paddleService';
import {config} from '../../../src/config/index';

// Mock the Paddle Node SDK
const mockCreate = jest.fn();
const mockList = jest.fn();

jest.mock('@paddle/paddle-node-sdk', () => {
  return {
    Paddle: jest.fn().mockImplementation(() => {
      return {
        customers: {
          create: mockCreate,
          list: mockList,
        },
      };
    }),
    Environment: {
      sandbox: 'sandbox',
      production: 'production',
    },
  };
});

describe('PaddleService.ensureCustomer', () => {
  const originalApiKey = config.PADDLE_API_KEY;

  beforeAll(() => {
    config.PADDLE_API_KEY = 'pdl_sdbx_apikey_test';
  });

  afterAll(() => {
    config.PADDLE_API_KEY = originalApiKey;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns existingPaddleCustomerId immediately if provided', async () => {
    const customerId = await paddleService.ensureCustomer({
      userId: 'user_1',
      email: 'test@example.com',
      displayName: 'Test User',
      existingPaddleCustomerId: 'ctm_existing',
    });
    expect(customerId).toBe('ctm_existing');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates a new customer if none exists', async () => {
    mockCreate.mockResolvedValue({id: 'ctm_new'});

    const customerId = await paddleService.ensureCustomer({
      userId: 'user_2',
      email: 'new@example.com',
      displayName: 'New User',
    });

    expect(customerId).toBe('ctm_new');
    expect(mockCreate).toHaveBeenCalledWith({
      email: 'new@example.com',
      name: 'New User',
      customData: {userId: 'user_2'},
    });
  });

  it('extracts customer ID from conflict error message directly and avoids API list query', async () => {
    const apiError = new Error('customer email conflicts with customer of id ctm_01kt8ygxa3bw4b5khhcvdnet9j') as any;
    apiError.code = 'conflict';
    apiError.detail = 'customer email conflicts with customer of id ctm_01kt8ygxa3bw4b5khhcvdnet9j';

    mockCreate.mockRejectedValue(apiError);

    const customerId = await paddleService.ensureCustomer({
      userId: 'user_3',
      email: 'conflict@example.com',
      displayName: 'Conflict User',
    });

    expect(customerId).toBe('ctm_01kt8ygxa3bw4b5khhcvdnet9j');
    expect(mockCreate).toHaveBeenCalled();
    expect(mockList).not.toHaveBeenCalled();
  });

  it('falls back to querying list API if customer ID is not in conflict error message', async () => {
    const apiError = new Error('conflict') as any;
    apiError.code = 'conflict';
    apiError.detail = 'conflict without id';

    mockCreate.mockRejectedValue(apiError);

    // Mock async iterator return for list
    const mockIterator = {
      [Symbol.asyncIterator]() {
        let index = 0;
        const items = [{id: 'ctm_list_resolved'}];
        return {
          async next() {
            if (index < items.length) {
              return {value: items[index++], done: false};
            }
            return {value: undefined, done: true};
          },
        };
      },
    };
    mockList.mockReturnValue(mockIterator);

    const customerId = await paddleService.ensureCustomer({
      userId: 'user_4',
      email: 'fallback@example.com',
      displayName: 'Fallback User',
    });

    expect(customerId).toBe('ctm_list_resolved');
    expect(mockCreate).toHaveBeenCalled();
    expect(mockList).toHaveBeenCalledWith({email: ['fallback@example.com']});
  });

  it('throws original conflict error if ID cannot be resolved (regex fails and list is empty)', async () => {
    const apiError = new Error('conflict') as any;
    apiError.code = 'conflict';
    apiError.detail = 'conflict without id';

    mockCreate.mockRejectedValue(apiError);

    // Mock empty async iterator
    const mockIterator = {
      [Symbol.asyncIterator]() {
        return {
          async next() {
            return {value: undefined, done: true};
          },
        };
      },
    };
    mockList.mockReturnValue(mockIterator);

    await expect(
      paddleService.ensureCustomer({
        userId: 'user_5',
        email: 'notfound@example.com',
        displayName: 'Not Found User',
      })
    ).rejects.toThrow('conflict');

    expect(mockCreate).toHaveBeenCalled();
    expect(mockList).toHaveBeenCalledWith({email: ['notfound@example.com']});
  });

  it('throws original error immediately for non-conflict errors', async () => {
    const otherError = new Error('api offline') as any;
    otherError.code = 'service_unavailable';

    mockCreate.mockRejectedValue(otherError);

    await expect(
      paddleService.ensureCustomer({
        userId: 'user_6',
        email: 'other@example.com',
        displayName: 'Other Error User',
      })
    ).rejects.toThrow('api offline');

    expect(mockCreate).toHaveBeenCalled();
    expect(mockList).not.toHaveBeenCalled();
  });
});
