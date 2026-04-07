import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../../common/decorators/roles.decorator";
import { RbacGuard } from "../../../common/guards/rbac.guard";
import { SharedJwtGuard } from "../../../common/guards/shared-jwt.guard";
import { OrgChartService } from "./org-chart.service";

@Controller("org-chart")
@UseGuards(SharedJwtGuard, RbacGuard)
@ApiTags("Organization - Org Chart")
export class OrgChartController {
  constructor(private readonly orgChartService: OrgChartService) {}

  @Get()
  @Roles("HR_ADMIN", "EXECUTIVE", "SYSTEM")
  @ApiOperation({ summary: "Get full organizational hierarchy" })
  @ApiResponse({ status: 200, description: "Org chart hierarchy" })
  getOrgChart() {
    return this.orgChartService.getOrgChart();
  }
}
