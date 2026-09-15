import { DEFAULT_DEV_JWT_SECRET, gatewayConfig } from './gateway.config';

describe('gatewayConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.API_GATEWAY_JWT_SECRET;
    delete process.env.JWT_SECRET;
    delete process.env.API_GATEWAY_UPSTREAM_TIMEOUT_MS;
    delete process.env.API_GATEWAY_AI_UPSTREAM_TIMEOUT_MS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses the shared local development JWT secret when no env secret is set', () => {
    expect(gatewayConfig().jwtSecret).toBe(DEFAULT_DEV_JWT_SECRET);
  });

  it('prefers API_GATEWAY_JWT_SECRET over the shared JWT_SECRET', () => {
    process.env.API_GATEWAY_JWT_SECRET = 'gateway-secret';
    process.env.JWT_SECRET = 'shared-secret';

    expect(gatewayConfig().jwtSecret).toBe('gateway-secret');
  });

  it('uses JWT_SECRET when no gateway-specific secret is set', () => {
    process.env.JWT_SECRET = 'shared-secret';

    expect(gatewayConfig().jwtSecret).toBe('shared-secret');
  });

  it('uses a dedicated 60s default timeout for AI routes', () => {
    process.env.API_GATEWAY_UPSTREAM_TIMEOUT_MS = '2500';

    const aiRoute = gatewayConfig().routes.find((route) => route.key === 'ai');

    expect(aiRoute?.timeoutMs).toBe(60_000);
  });

  it('allows the AI upstream timeout to be overridden independently', () => {
    process.env.API_GATEWAY_UPSTREAM_TIMEOUT_MS = '2500';
    process.env.API_GATEWAY_AI_UPSTREAM_TIMEOUT_MS = '45000';

    const config = gatewayConfig();
    const hrRoute = config.routes.find((route) => route.key === 'hr');
    const aiRoute = config.routes.find((route) => route.key === 'ai');

    expect(hrRoute?.timeoutMs).toBe(2_500);
    expect(aiRoute?.timeoutMs).toBe(45_000);
  });
});
