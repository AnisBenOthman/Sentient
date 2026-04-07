import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { DepartmentsController } from "./departments/departments.controller";
import { DepartmentsService } from "./departments/departments.service";
import { OrgChartController } from "./org-chart/org-chart.controller";
import { OrgChartService } from "./org-chart/org-chart.service";
import { PositionsController } from "./positions/positions.controller";
import { PositionsService } from "./positions/positions.service";
import { TeamsController } from "./teams/teams.controller";
import { TeamsService } from "./teams/teams.service";

@Module({
  imports: [PrismaModule],
  controllers: [
    DepartmentsController,
    TeamsController,
    PositionsController,
    OrgChartController,
  ],
  providers: [
    DepartmentsService,
    TeamsService,
    PositionsService,
    OrgChartService,
  ],
  exports: [
    DepartmentsService,
    TeamsService,
    PositionsService,
    OrgChartService,
  ],
})
export class OrganizationModule {}
