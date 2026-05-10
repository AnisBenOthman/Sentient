import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtPayload, SharedJwtGuard, RbacGuard } from '@sentient/shared';
import { UserStatusGuard } from '../../iam/guards/user-status.guard';
import { LeaveQueryDto } from '../dto/leave-query.dto';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

function makeJwt(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    sub: 'user-1',
    employeeId: 'emp-1',
    roles: ['EMPLOYEE'],
    departmentId: 'dept-1',
    teamId: null,
    businessUnitId: 'bu-1',
    channel: 'WEB' as JwtPayload['channel'],
    roleAssignments: [],
    sessionId: 'sess-1',
    iat: 0,
    exp: 9_999_999_999,
    ...overrides,
  };
}

describe('RequestsController — resolveTargetEmployeeId', () => {
  let controller: RequestsController;
  let service: jest.Mocked<Pick<RequestsService, 'findByEmployee'>>;

  beforeEach(async () => {
    const mockService = { findByEmployee: jest.fn().mockResolvedValue([]) };

    const module = await Test.createTestingModule({
      controllers: [RequestsController],
      providers: [{ provide: RequestsService, useValue: mockService }],
    })
      .overrideGuard(SharedJwtGuard).useValue({ canActivate: () => true })
      .overrideGuard(UserStatusGuard).useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get(RequestsController);
    service = module.get(RequestsService) as jest.Mocked<Pick<RequestsService, 'findByEmployee'>>;
  });

  it('EMPLOYEE: ignores query.employeeId and uses own id', async () => {
    const user = makeJwt({ roles: ['EMPLOYEE'], employeeId: 'emp-1' });
    await controller.findByEmployee({ employeeId: 'emp-other' } as LeaveQueryDto, user);
    expect(service.findByEmployee).toHaveBeenCalledWith('emp-1', expect.anything());
  });

  it('MANAGER: ignores query.employeeId and uses own id', async () => {
    const user = makeJwt({ roles: ['MANAGER'], employeeId: 'emp-1' });
    await controller.findByEmployee({ employeeId: 'emp-other' } as LeaveQueryDto, user);
    expect(service.findByEmployee).toHaveBeenCalledWith('emp-1', expect.anything());
  });

  it('HR_ADMIN: resolves to query.employeeId when provided', async () => {
    const user = makeJwt({ roles: ['HR_ADMIN'], employeeId: 'emp-1' });
    await controller.findByEmployee({ employeeId: 'emp-other' } as LeaveQueryDto, user);
    expect(service.findByEmployee).toHaveBeenCalledWith('emp-other', expect.anything());
  });

  it('EXECUTIVE: resolves to query.employeeId when provided', async () => {
    const user = makeJwt({ roles: ['EXECUTIVE'], employeeId: 'emp-1' });
    await controller.findByEmployee({ employeeId: 'emp-other' } as LeaveQueryDto, user);
    expect(service.findByEmployee).toHaveBeenCalledWith('emp-other', expect.anything());
  });

  it('HR_ADMIN without query.employeeId falls back to own id', async () => {
    const user = makeJwt({ roles: ['HR_ADMIN'], employeeId: 'emp-1' });
    await controller.findByEmployee({} as LeaveQueryDto, user);
    expect(service.findByEmployee).toHaveBeenCalledWith('emp-1', expect.anything());
  });

  it('throws ForbiddenException when JWT has no employeeId', async () => {
    const user = makeJwt({ roles: ['EMPLOYEE'], employeeId: null });
    await expect(
      controller.findByEmployee({} as LeaveQueryDto, user),
    ).rejects.toThrow(ForbiddenException);
  });
});
