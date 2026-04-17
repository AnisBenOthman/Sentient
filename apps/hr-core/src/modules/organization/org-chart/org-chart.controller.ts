import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
// import { Roles } from "../../../common/decorators/roles.decorator"; // TODO: re-enable when IAM module is implemented
// import { RbacGuard } from "../../../common/guards/rbac.guard"; // TODO: re-enable when IAM module is implemented
// import { SharedJwtGuard } from "../../../common/guards/shared-jwt.guard"; // TODO: re-enable when IAM module is implemented
import { OrgChartService } from "./org-chart.service";

@Controller("org-chart")
// @UseGuards(SharedJwtGuard, RbacGuard) // TODO: re-enable when IAM module is implemented
@ApiTags("Organization - Org Chart")
export class OrgChartController {
  constructor(private readonly orgChartService: OrgChartService) {}

  @Get()
  // @Roles("HR_ADMIN", "EXECUTIVE", "SYSTEM") // TODO: re-enable when IAM module is implemented
  @ApiOperation({ summary: "Get full organizational hierarchy" })
  @ApiResponse({ status: 200, description: "Org chart hierarchy" })
  getOrgChart() {
    return this.orgChartService.getOrgChart();
  }
}
