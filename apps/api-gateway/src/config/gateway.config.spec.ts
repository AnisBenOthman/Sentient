import { DEFAULT_DEV_JWT_SECRET, gatewayConfig } from './gateway.config';

describe('gatewayConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.API_GATEWAY_JWT_SECRET;
    delete process.env.JWT_SECRET;
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
});
