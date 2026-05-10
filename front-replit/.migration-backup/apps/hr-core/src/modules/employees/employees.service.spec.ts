import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from '../../generated/prisma/runtime/library';
import { EVENT_BUS, JwtPayload, EmploymentStatus, ContractType } from '@sentient/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeStatusDto } from './dto/update-employee-status.dto';
import { EmployeesService } from './employees.service';

const mockPrisma = {
  employee: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  position: { findUnique: jest.fn() },
  department: { findUnique: jest.fn() },
  team: { findUnique: jest.fn() },
  salaryHistory: { findMany: jest.fn() },
  $transaction: jest.fn(),
};

const mockEventBus = { emit: jest.fn().mockResolvedValue(undefined), subscribe: jest.fn() };

const adminUser: JwtPayload = {
  sub: 'user-admin', employeeId: 'emp-admin', roles: ['HR_ADMIN'],
  departmentId: 'dept-1', teamId: null, businessUnitId: null,
  channel: 'WEB' as any, roleAssignments: [], sessionId: 'test-session',
  iat: 0, exp: 9999999999,
};

const employeeUser: JwtPayload = {
  sub: 'user-emp', employeeId: 'emp-001', roles: ['EMPLOYEE'],
  departmentId: 'dept-1', teamId: 'team-1', businessUnitId: null,
  channel: 'WEB' as any, roleAssignments: [], sessionId: 'test-session',
  iat: 0, exp: 9999999999,
};

const managerUser: JwtPayload = {
  sub: 'user-mgr', employeeId: 'emp-mgr', roles: ['MANAGER'],
  departmentId: 'dept-1', teamId: 'team-1', businessUnitId: null,
  channel: 'WEB' as any, roleAssignments: [], sessionId: 'test-session',
  iat: 0, exp: 9999999999,
};

const baseEmployee = {
  id: 'emp-001',
  employeeCode: 'EMP-0001',
  firstName: 'Anis',
  lastName: 'Ben',
  email: 'anis@sentient.dev',
  phone: null,
  dateOfBirth: null,
  hireDate: new Date('2024-01-15'),
  employmentStatus: 'ACTIVE' as EmploymentStatus,
  contractType: 'FULL_TIME' as ContractType,
  grossSalary: new Decimal('70000'),
  netSalary: new Decimal('58000'),
  maritalStatus: null,
  educationLevel: null,
  educationField: null,
  positionId: null,
  departmentId: 'dept-1',
  teamId: 'team-1',
  managerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  department: { id: 'dept-1', name: 'Engineering' },
  team: { id: 'team-1', name: 'Alpha' },
  position: null,
  manager: null,
};

describe('EmployeesService', () => {
  let service: EmployeesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EVENT_BUS, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get(EmployeesService);
  });

  // ---- buildScopeFilter (via findAll) ----

  describe('scope filtering', () => {
    beforeEach(() => {
      mockPrisma.employee.findMany.mockResolvedValue([]);
      mockPrisma.employee.count.mockResolvedValue(0);
    });

    it('HR_ADMIN gets empty scope filter (all employees)', async () => {
      await service.findAll({}, adminUser);
      const [call] = mockPrisma.employee.findMany.mock.calls;
      const where = (call as any[])[0].where as { AND: unknown[] };
      // scopeFilter for HR_ADMIN is {} — AND should contain an empty object
      expect(where.AND).toContainEqual({});
    });

    it('EMPLOYEE scope filter restricts to own employeeId', async () => {
      await service.findAll({}, employeeUser);
      const [call] = mockPrisma.employee.findMany.mock.calls;
      const where = (call as any[])[0].where as { AND: unknown[] };
      expect(where.AND).toContainEqual({ id: employeeUser.employeeId });
    });

    it('MANAGER scope filter restricts to teamId', async () => {
      await service.findAll({}, managerUser);
      const [call] = mockPrisma.employee.findMany.mock.calls;
      const where = (call as any[])[0].where as { AND: unknown[] };
      expect(where.AND).toContainEqual({ teamId: managerUser.teamId });
    });
  });

  // ---- findById ----

  describe('findById', () => {
    it('returns profile when within scope', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(baseEmployee);
      const result = await service.findById('emp-001', adminUser);
      expect(result.id).toBe('emp-001');
    });

    it('throws ForbiddenException when employee exists but is out of scope', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(null);
      mockPrisma.employee.findUnique.mockResolvedValue({ id: 'emp-other' });
      await expect(service.findById('emp-other', employeeUser)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when employee does not exist', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(null);
      mockPrisma.employee.findUnique.mockResolvedValue(null);
      await expect(service.findById('nonexistent', adminUser)).rejects.toThrow(NotFoundException);
    });

    it('strips salary and DOB for non-privileged roles', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(baseEmployee);
      const result = await service.findById('emp-001', employeeUser);
      expect(result.grossSalary).toBeNull();
      expect(result.netSalary).toBeNull();
      expect(result.dateOfBirth).toBeNull();
    });

    it('returns salary for HR_ADMIN', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(baseEmployee);
      const result = await service.findById('emp-001', adminUser);
      expect(result.grossSalary).not.toBeNull();
    });
  });

  // ---- create ----

  describe('create', () => {
    const dto: CreateEmployeeDto = {
      firstName: 'Sara',
      lastName: 'Smith',
      email: 'sara@sentient.dev',
      hireDate: '2026-01-01',
      contractType: ContractType.FULL_TIME,
    };

    it('auto-generates employee code when not provided', async () => {
      mockPrisma.employee.findFirst
        .mockResolvedValueOnce(null) // email unique check
        .mockResolvedValueOnce(null) // last employee for code generation
        .mockResolvedValueOnce(null); // code unique check
      mockPrisma.employee.create.mockResolvedValue({ ...baseEmployee, employeeCode: 'EMP-0001' });

      const result = await service.create(dto, 'user-admin');
      expect(result.employeeCode).toBe('EMP-0001');
    });

    it('throws ConflictException on duplicate email', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(baseEmployee); // email already exists
      await expect(service.create({ ...dto, email: 'anis@sentient.dev' }, 'user-admin')).rejects.toThrow(ConflictException);
    });
  });

  // ---- updateStatus ----

  describe('updateStatus', () => {
    it('throws ConflictException when transitioning to same status', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({ ...baseEmployee, employmentStatus: 'ACTIVE' });
      const dto: UpdateEmployeeStatusDto = { status: EmploymentStatus.ACTIVE };
      await expect(service.updateStatus('emp-001', dto, 'user-admin')).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException when transitioning from TERMINATED', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({ ...baseEmployee, employmentStatus: 'TERMINATED' });
      const dto: UpdateEmployeeStatusDto = { status: EmploymentStatus.ACTIVE };
      await expect(service.updateStatus('emp-001', dto, 'user-admin')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when transitioning from RESIGNED', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({ ...baseEmployee, employmentStatus: 'RESIGNED' });
      const dto: UpdateEmployeeStatusDto = { status: EmploymentStatus.ACTIVE };
      await expect(service.updateStatus('emp-001', dto, 'user-admin')).rejects.toThrow(BadRequestException);
    });

    it('emits employee.terminated event on TERMINATED transition', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({ ...baseEmployee, employmentStatus: 'ACTIVE' });
      mockPrisma.employee.update.mockResolvedValue({ ...baseEmployee, employmentStatus: 'TERMINATED' });
      const dto: UpdateEmployeeStatusDto = { status: EmploymentStatus.TERMINATED, reason: 'Redundancy' };

      await service.updateStatus('emp-001', dto, 'user-admin');
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'employee.terminated' }),
      );
    });

    it('emits employee.updated event on non-terminal transition', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({ ...baseEmployee, employmentStatus: 'ACTIVE' });
      mockPrisma.employee.update.mockResolvedValue({ ...baseEmployee, employmentStatus: 'ON_LEAVE' });
      const dto: UpdateEmployeeStatusDto = { status: EmploymentStatus.ON_LEAVE };

      await service.updateStatus('emp-001', dto, 'user-admin');
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'employee.updated' }),
      );
    });
  });

  // ---- getSalaryHistory ----

  describe('getSalaryHistory', () => {
    it('throws NotFoundException when employee does not exist', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(null);
      await expect(service.getSalaryHistory('nonexistent', 50)).rejects.toThrow(NotFoundException);
    });

    it('returns salary history ordered by effectiveDate desc', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({ id: 'emp-001' });
      const history = [
        { id: 'sh-2', effectiveDate: new Date('2026-03-01') },
        { id: 'sh-1', effectiveDate: new Date('2025-01-01') },
      ];
      mockPrisma.salaryHistory.findMany.mockResolvedValue(history);

      const result = await service.getSalaryHistory('emp-001', 50);
      expect(result).toHaveLength(2);
      expect(mockPrisma.salaryHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { effectiveDate: 'desc' } }),
      );
    });
  });
});
