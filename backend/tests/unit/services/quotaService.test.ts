import {QuotaService, PLAN_LIMITS, QuotaExceededError} from '../../../src/services/quotaService';
import {Plan} from '@prisma/client';

function makeRedisMock(dailyCount: number, monthlyCount: number) {
  return {
    incr: jest.fn()
      .mockResolvedValueOnce(dailyCount)
      .mockResolvedValueOnce(monthlyCount),
    expire: jest.fn().mockResolvedValue(1),
    get: jest.fn().mockResolvedValue(null),
  };
}

function makePrismaMock(plan: Plan) {
  return {
    app: {
      findUnique: jest.fn().mockResolvedValue({user: {plan}}),
    },
  };
}

describe('PLAN_LIMITS', () => {
  it('FREE: dailyInstalls=20, monthlyInstalls=500', () => {
    expect(PLAN_LIMITS.FREE.dailyInstalls).toBe(20);
    expect(PLAN_LIMITS.FREE.monthlyInstalls).toBe(500);
  });

  it('PRO: no daily limit, monthlyInstalls=10000', () => {
    expect(PLAN_LIMITS.PRO.dailyInstalls).toBe(Infinity);
    expect(PLAN_LIMITS.PRO.monthlyInstalls).toBe(10_000);
  });

  it('UNLIMITED: no limits', () => {
    expect(PLAN_LIMITS.UNLIMITED.dailyInstalls).toBe(Infinity);
    expect(PLAN_LIMITS.UNLIMITED.monthlyInstalls).toBe(Infinity);
  });
});

describe('QuotaService.checkAndIncrement', () => {
  it('allows FREE plan under both limits', async () => {
    const svc = new QuotaService(makePrismaMock(Plan.FREE) as any, makeRedisMock(5, 100) as any);
    await expect(svc.checkAndIncrement('app_1')).resolves.toBeUndefined();
  });

  it('throws QuotaExceededError when FREE daily limit hit', async () => {
    const svc = new QuotaService(makePrismaMock(Plan.FREE) as any, makeRedisMock(21, 100) as any);
    const err = await svc.checkAndIncrement('app_1').catch(e => e);
    expect(err).toBeInstanceOf(QuotaExceededError);
    expect(err.period).toBe('daily');
    expect(err.limit).toBe(20);
  });

  it('throws QuotaExceededError when FREE monthly limit hit', async () => {
    const svc = new QuotaService(makePrismaMock(Plan.FREE) as any, makeRedisMock(5, 501) as any);
    const err = await svc.checkAndIncrement('app_1').catch(e => e);
    expect(err).toBeInstanceOf(QuotaExceededError);
    expect(err.period).toBe('monthly');
    expect(err.limit).toBe(500);
  });

  it('allows PRO plan with high daily count (no daily cap)', async () => {
    const svc = new QuotaService(makePrismaMock(Plan.PRO) as any, makeRedisMock(9999, 500) as any);
    await expect(svc.checkAndIncrement('app_1')).resolves.toBeUndefined();
  });

  it('throws QuotaExceededError when PRO monthly limit hit', async () => {
    const svc = new QuotaService(makePrismaMock(Plan.PRO) as any, makeRedisMock(100, 10_001) as any);
    const err = await svc.checkAndIncrement('app_1').catch(e => e);
    expect(err).toBeInstanceOf(QuotaExceededError);
    expect(err.period).toBe('monthly');
    expect(err.limit).toBe(10_000);
  });

  it('allows UNLIMITED plan regardless of counts (skips Redis)', async () => {
    const redis = makeRedisMock(999_999, 999_999);
    const svc = new QuotaService(makePrismaMock(Plan.UNLIMITED) as any, redis as any);
    await expect(svc.checkAndIncrement('app_1')).resolves.toBeUndefined();
    // Should not touch Redis at all for UNLIMITED
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it('throws if app not found in DB', async () => {
    const prisma = {app: {findUnique: jest.fn().mockResolvedValue(null)}} as any;
    const svc = new QuotaService(prisma, makeRedisMock(1, 1) as any);
    await expect(svc.checkAndIncrement('nonexistent')).rejects.toThrow('App not found');
  });

  it('sets TTL on Redis keys', async () => {
    const redis = makeRedisMock(5, 100);
    const svc = new QuotaService(makePrismaMock(Plan.FREE) as any, redis as any);
    await svc.checkAndIncrement('app_1');
    expect(redis.expire).toHaveBeenCalledTimes(2);
    expect(redis.expire).toHaveBeenCalledWith(expect.stringContaining('daily'), 48 * 60 * 60);
    expect(redis.expire).toHaveBeenCalledWith(expect.stringContaining('monthly'), 35 * 24 * 60 * 60);
  });
});
