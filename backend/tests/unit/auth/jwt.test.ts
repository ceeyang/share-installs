import {signJwt, verifyJwt} from '../../../src/auth/jwt';

const secret = 'a'.repeat(32);

describe('signJwt / verifyJwt', () => {
  it('round-trips a valid token', () => {
    const payload = {sub: 'user_abc', githubLogin: 'octocat'};
    const token = signJwt(payload, secret);
    expect(typeof token).toBe('string');
    const decoded = verifyJwt(token, secret);
    expect(decoded).toMatchObject(payload);
  });

  it('returns null for tampered token', () => {
    const token = signJwt({sub: 'x', githubLogin: 'y'}, secret);
    const tampered = token.slice(0, -4) + 'XXXX';
    expect(verifyJwt(tampered, secret)).toBeNull();
  });

  it('returns null for expired token', () => {
    const token = signJwt({sub: 'x', githubLogin: 'y'}, secret, -1);
    expect(verifyJwt(token, secret)).toBeNull();
  });

  it('returns null for wrong secret', () => {
    const token = signJwt({sub: 'x', githubLogin: 'y'}, secret);
    expect(verifyJwt(token, 'b'.repeat(32))).toBeNull();
  });
});
