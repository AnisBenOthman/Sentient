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
        teams: {
          where: { isActive: true },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return Promise.all(
      departments.map(async (department) => ({
        id: department.id,
        name: department.name,
        code: department.code,
        headId: department.headId,
        teams: await Promise.all(
          department.teams.map(async (team) => {
            const [employeeCount, lead] = await Promise.all([
              this.prisma.employee.count({
                where: {
                  teamId: team.id,
                  employmentStatus: {
                    not: EmploymentStatus.TERMINATED,
                  },
                },
              }),
              team.leadId
                ? this.prisma.employee.findUnique({
                    where: { id: team.leadId },
                    select: { employmentStatus: true },
                  })
                : Promise.resolve(null),
            ]);

            return {
              id: team.id,
              name: team.name,
              code: team.code,
              leadId: team.leadId,
              leadVacant:
                Boolean(team.leadId) &&
                (!lead ||
                  lead.employmentStatus === EmploymentStatus.TERMINATED),
              projectFocus: team.projectFocus,
              employeeCount,
            };
          }),
        ),
      })),
    );
  }
}
