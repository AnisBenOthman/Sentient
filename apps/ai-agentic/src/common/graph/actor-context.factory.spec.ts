import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { ChannelType } from '@sentient/shared';
import { ActorContextFactory } from './actor-context.factory';

const SECRET = 'unit-test-secret';
const config = { getOrThrow: () => SECRET } as unknown as ConfigService;

function sign(overrides: Record<string, unknown> = {}, options: jwt.SignOptions = { expiresIn: '5m' }): string {
  return jwt.sign(
    {
      sub: 'user-1', employeeId: 'employee-1', roles: ['EMPLOYEE'],
      departmentId: 'dept-1', teamId: null, businessUnitId: 'bu-1',
      channel: ChannelType.TELEGRAM, sessionId: 'session-1',
      roleAssignments: [{ roleCode: 'EMPLOYEE', scope: 'OWN', scopeEntityId: null }],
      ...overrides,
    },
    SECRET,
    options,
  );
}

describe('ActorContextFactory.fromChannelToken', () => {
  const factory = new ActorContextFactory(config);
  const options = { channel: ChannelType.TELEGRAM, correlationId: 'tg-1' };

  it('maps every claim from a valid token issued for the channel', () => {
    const token = sign();
    const actor = factory.fromChannelToken(token, options);
    expect(actor).toEqual({
      jwt: token,
      userId: 'user-1',
      employeeId: 'employee-1',
      roles: ['EMPLOYEE'],
      departmentId: 'dept-1',
      teamId: null,
      businessUnitId: 'bu-1',
      roleAssignments: [{ roleCode: 'EMPLOYEE', scope: 'OWN', scopeEntityId: null }],
      correlationId: 'tg-1',
    });
  });

  it('rejects a token signed with a different secret (verify, never decode)', () => {
    const forged = jwt.sign({ sub: 'user-1', roles: ['EMPLOYEE'], channel: ChannelType.TELEGRAM }, 'wrong-secret');
    expect(() => factory.fromChannelToken(forged, options)).toThrow(UnauthorizedException);
  });

  it('rejects an expired token', () => {
    const expired = sign({}, { expiresIn: -10 });
    expect(() => factory.fromChannelToken(expired, options)).toThrow(UnauthorizedException);
  });

  it('rejects a WEB token replayed at the Telegram channel', () => {
    expect(() => factory.fromChannelToken(sign({ channel: ChannelType.WEB }), options)).toThrow(UnauthorizedException);
  });

  it('rejects an account whose roles do not permit the assistant', () => {
    expect(() => factory.fromChannelToken(sign({ roles: ['SOMETHING_ELSE'] }), options)).toThrow(ForbiddenException);
    expect(() => factory.fromChannelToken(sign({ roles: [] }), options)).toThrow(ForbiddenException);
  });
});
