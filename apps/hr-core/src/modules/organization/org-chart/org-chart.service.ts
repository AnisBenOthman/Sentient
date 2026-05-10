import { Injectable } from "@nestjs/common";
import { EmploymentStatus } from "@sentient/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { OrgChartResponse } from "./org-chart.types";

@Injectable()
export class OrgChartService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrgChart(): Promise<OrgChartResponse> {
    const departments = await this.prisma.department.findMany({
      where: { isActive: true },
      include: {
        employees: {
          where: { employmentStatus: { not: EmploymentStatus.TERMINATED } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            position: { select: { id: true, title: true } },
          },
        },
        teams: {
          where: { isActive: true },
          include: {
            employees: {
              where: { employmentStatus: { not: EmploymentStatus.TERMINATED } },
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                position: { select: { id: true, title: true } },
              },
            },
          },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    return departments.map((department) => ({
      id: department.id,
      name: department.name,
      code: department.code,
      businessUnitId: department.businessUnitId,
      headId: department.headId,
      head: department.employees.find((employee) => employee.id === department.headId) ?? null,
      teams: department.teams.map((team) => {
        const lead = team.employees.find((employee) => employee.id === team.leadId) ?? null;

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
          employeeCount: team.employees.length,
        };
      }),
    }));
  }
}
