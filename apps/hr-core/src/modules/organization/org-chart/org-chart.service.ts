import { Injectable } from "@nestjs/common";
import { EmploymentStatus, Prisma } from "../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import { OrgChartEmployee, OrgChartResponse } from "./org-chart.types";

const ACTIVE_EMPLOYEE_WHERE: Prisma.EmployeeWhereInput = {
  deletedAt: null,
  employmentStatus: { notIn: [EmploymentStatus.TERMINATED, EmploymentStatus.RESIGNED] },
};

const ORG_EMPLOYEE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  hireDate: true,
  employmentStatus: true,
  departmentId: true,
  teamId: true,
  managerId: true,
  position: { select: { id: true, title: true } },
  skills: {
    where: { deletedAt: null },
    select: {
      proficiency: true,
      skill: { select: { name: true } },
    },
    orderBy: { skill: { name: "asc" as const } },
  },
} as const;

type OrgEmployeeRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  hireDate: Date;
  employmentStatus: string;
  departmentId: string | null;
  teamId: string | null;
  managerId: string | null;
  position: { id: string; title: string } | null;
  skills: Array<{ proficiency: string; skill: { name: string } }>;
};

@Injectable()
export class OrgChartService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrgChart(): Promise<OrgChartResponse> {
    const [root, departments] = await Promise.all([
      this.prisma.employee.findFirst({
        where: {
          ...ACTIVE_EMPLOYEE_WHERE,
          departmentId: null,
          teamId: null,
          managerId: null,
        },
        select: ORG_EMPLOYEE_SELECT,
        orderBy: [{ hireDate: "asc" }, { createdAt: "asc" }],
      }),
      this.prisma.department.findMany({
        where: { isActive: true },
        include: {
          employees: {
            where: ACTIVE_EMPLOYEE_WHERE,
            select: ORG_EMPLOYEE_SELECT,
            orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
          },
          teams: {
            where: { isActive: true },
            include: {
              employees: {
                where: ACTIVE_EMPLOYEE_WHERE,
                select: ORG_EMPLOYEE_SELECT,
                orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
              },
            },
            orderBy: { name: "asc" },
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    return {
      root: root ? this.toOrgEmployee(root) : null,
      departments: departments.map((department) => ({
        id: department.id,
        name: department.name,
        code: department.code,
        businessUnitId: department.businessUnitId,
        headId: department.headId,
        head: this.findOrgEmployee(department.employees, department.headId),
        teams: department.teams.map((team) => {
          const members = team.employees.map((employee) => this.toOrgEmployee(employee));
          const lead = members.find((employee) => employee.id === team.leadId) ?? null;

          return {
            id: team.id,
            name: team.name,
            code: team.code,
            departmentId: team.departmentId,
            businessUnitId: team.businessUnitId,
            leadId: team.leadId,
            lead,
            leadVacant: Boolean(team.leadId) && !lead,
            projectFocus: team.projectFocus,
            employeeCount: members.length,
            members,
          };
        }),
      })),
    };
  }

  private findOrgEmployee(
    employees: OrgEmployeeRecord[],
    employeeId: string | null,
  ): OrgChartEmployee | null {
    if (!employeeId) return null;
    const employee = employees.find((candidate) => candidate.id === employeeId);
    return employee ? this.toOrgEmployee(employee) : null;
  }

  private toOrgEmployee(employee: OrgEmployeeRecord): OrgChartEmployee {
    return {
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      hireDate: employee.hireDate.toISOString(),
      employmentStatus: employee.employmentStatus,
      departmentId: employee.departmentId,
      teamId: employee.teamId,
      managerId: employee.managerId,
      position: employee.position,
      skills: employee.skills.map((skill) => ({
        skill: skill.skill.name,
        proficiency: skill.proficiency,
      })),
    };
  }
}
