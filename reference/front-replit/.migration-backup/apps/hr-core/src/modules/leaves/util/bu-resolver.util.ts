import { BusinessUnit, Department, Employee, Team } from '../../../generated/prisma';

type EmployeeWithBu = Employee & {
  team: (Team & { businessUnit: BusinessUnit }) | null;
  department: (Department & { businessUnit: BusinessUnit }) | null;
};

export function resolveEmployeeBusinessUnitId(employee: EmployeeWithBu): string | null {
  return employee.team?.businessUnit.id ?? employee.department?.businessUnit.id ?? null;
}
