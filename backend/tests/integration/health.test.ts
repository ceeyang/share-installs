/**
 * Integration tests – GET /health
 */

import {buildApp} from './helpers';

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const {agent} = buildApp();
    const res = await agent.get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.timestamp).toBe('string');
    expect(res.body.version).toBeDefined();
    expect(res.body.mode).toBe('self-hosted');
  });

  it('sets X-Request-Id on every response', async () => {
    const {agent} = buildApp();
    const res = await agent.get('/health');

    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('echoes a caller-supplied X-Request-Id', async () => {
    const {agent} = buildApp();
    const myId = 'my-trace-id-12345';
    const res = await agent.get('/health').set('X-Request-Id', myId);

    expect(res.headers['x-request-id']).toBe(myId);
  });

  it('returns 404 for unknown paths', async () => {
    const {agent} = buildApp();
    const res = await agent.get('/v1/nonexistent');

    expect(res.status).toBe(404);
  });
});
