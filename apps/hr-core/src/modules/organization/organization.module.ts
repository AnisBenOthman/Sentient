import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { BusinessUnitsController } from "./business-units/business-units.controller";
import { BusinessUnitsService } from "./business-units/business-units.service";
import { DepartmentsController } from "./departments/departments.controller";
import { DepartmentsService } from "./departments/departments.service";
import { OrgChartController } from "./org-chart/org-chart.controller";
import { OrgChartService } from "./org-chart/org-chart.service";
import { PositionSkillsController } from "./positions/position-skills.controller";
import { PositionSkillsService } from "./positions/position-skills.service";
import { PositionsController } from "./positions/positions.controller";
import { PositionsService } from "./positions/positions.service";
import { TeamsController } from "./teams/teams.controller";
import { TeamsService } from "./teams/teams.service";

@Module({
  imports: [PrismaModule],
  controllers: [
    BusinessUnitsController,
    DepartmentsController,
    TeamsController,
    PositionsController,
    PositionSkillsController,
    OrgChartController,
  ],
  providers: [
    BusinessUnitsService,
    DepartmentsService,
    TeamsService,
    PositionsService,
    PositionSkillsService,
    OrgChartService,
  ],
  exports: [
    BusinessUnitsService,
    DepartmentsService,
    TeamsService,
    PositionsService,
    OrgChartService,
  ],
})
export class OrganizationModule {}
