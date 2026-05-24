import { resolveEmployeeBusinessUnitId } from './bu-resolver.util';
import { BusinessUnit, Department, Employee, Team } from '../../../generated/prisma';

function makeEmployee(overrides: Partial<{
  team: (Team & { businessUnit: BusinessUnit }) | null;
  department: (Department & { businessUnit: BusinessUnit }) | null;
}> = {}) {
  return {
    id: 'emp-1',
    employeeCode: 'E001',
    firstName: 'Test',
    lastName: 'User',
    email: 'test@sentient.dev',
    hireDate: new Date(),
    employmentStatus: 'ACTIVE' as const,
    contractType: 'FULL_TIME' as const,
    grossSalary: null,
    netSalary: null,
    maritalStatus: null,
    educationLevel: null,
    educationField: null,
    phone: null,
    dateOfBirth: null,
    positionId: null,
    departmentId: null,
    teamId: null,
    managerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    team: null,
    department: null,
    ...overrides,
  } as Employee & {
    team: (Team & { businessUnit: BusinessUnit }) | null;
    department: (Department & { businessUnit: BusinessUnit }) | null;
  };
}

const bu1 = { id: 'bu-1', name: 'BU 1', address: 'Algiers', isActive: true, createdAt: new Date(), updatedAt: new Date() };
const bu2 = { id: 'bu-2', name: 'BU 2', address: 'Oran', isActive: true, createdAt: new Date(), updatedAt: new Date() };

describe('resolveEmployeeBusinessUnitId', () => {
  it('returns team businessUnit id when team is present', () => {
    const emp = makeEmployee({
      team: { id: 't-1', name: 'T1', code: null, description: null, departmentId: 'd-1', businessUnitId: 'bu-1', leadId: null, projectFocus: null, isActive: true, createdAt: new Date(), updatedAt: new Date(), businessUnit: bu1 },
      department: { id: 'd-1', name: 'D1', code: 'D1', description: null, headId: null, businessUnitId: 'bu-2', isActive: true, createdAt: new Date(), updatedAt: new Date(), businessUnit: bu2 },
    });
    expect(resolveEmployeeBusinessUnitId(emp)).toBe('bu-1');
  });

  it('falls back to department businessUnit id when team is null', () => {
    const emp = makeEmployee({
      team: null,
      department: { id: 'd-1', name: 'D1', code: 'D1', description: null, headId: null, businessUnitId: 'bu-2', isActive: true, createdAt: new Date(), updatedAt: new Date(), businessUnit: bu2 },
    });
    expect(resolveEmployeeBusinessUnitId(emp)).toBe('bu-2');
  });

  it('returns null when both team and department are null', () => {
    const emp = makeEmployee({ team: null, department: null });
    expect(resolveEmployeeBusinessUnitId(emp)).toBeNull();
  });
});
