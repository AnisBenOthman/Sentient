import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ChannelType, JwtPayload } from "@sentient/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";

const DEV_USER: JwtPayload = {
  sub: 'dev-user-id', employeeId: 'dev-emp-id', roles: ['HR_ADMIN'],
  departmentId: 'dev-dept-id', teamId: null, channel: ChannelType.WEB, iat: 0, exp: 9999999999,
};
// import { Roles } from "../../../common/decorators/roles.decorator"; // TODO: re-enable when IAM module is implemented
// import { RbacGuard } from "../../../common/guards/rbac.guard"; // TODO: re-enable when IAM module is implemented
// import { SharedJwtGuard } from "../../../common/guards/shared-jwt.guard"; // TODO: re-enable when IAM module is implemented
import { CreateTeamDto } from "./dto/create-team.dto";
import { TeamQueryDto } from "./dto/team-query.dto";
import { UpdateTeamDto } from "./dto/update-team.dto";
import { TeamsService } from "./teams.service";

@Controller("teams")
// @UseGuards(SharedJwtGuard, RbacGuard) // TODO: re-enable when IAM module is implemented
@ApiTags("Organization - Teams")
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  // @Roles("HR_ADMIN") // TODO: re-enable when IAM module is implemented
  @ApiOperation({ summary: "Create a team" })
  create(@Body() createTeamDto: CreateTeamDto) {
    return this.teamsService.create(createTeamDto);
  }

  @Get()
  // @Roles("HR_ADMIN", "EXECUTIVE", "MANAGER") // TODO: re-enable when IAM module is implemented
  @ApiOperation({ summary: "List teams" })
  findAll(@Query() query: TeamQueryDto, @CurrentUser() user?: JwtPayload) {
    return this.teamsService.findAll(query, user ?? DEV_USER);
  }

  @Get(":id")
  // @Roles("HR_ADMIN", "EXECUTIVE", "MANAGER") // TODO: re-enable when IAM module is implemented
  @HttpCode(200)
  @ApiOperation({ summary: "Get team by id" })
  @ApiResponse({ status: 403, description: "Manager accessing another team" })
  findById(@Param("id") id: string, @CurrentUser() user?: JwtPayload) {
    return this.teamsService.findById(id, user ?? DEV_USER);
  }

  @Patch(":id")
  // @Roles("HR_ADMIN") // TODO: re-enable when IAM module is implemented
  @ApiOperation({ summary: "Update a team" })
  update(@Param("id") id: string, @Body() updateTeamDto: UpdateTeamDto) {
    return this.teamsService.update(id, updateTeamDto);
  }

  @Delete(":id")
  // @Roles("HR_ADMIN") // TODO: re-enable when IAM module is implemented
  @ApiOperation({ summary: "Deactivate a team" })
  deactivate(@Param("id") id: string) {
    return this.teamsService.deactivate(id);
  }
}
