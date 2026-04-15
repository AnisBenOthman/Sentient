import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ChannelType, JwtPayload } from "@sentient/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";

const DEV_USER: JwtPayload = {
  sub: 'dev-user-id', employeeId: 'dev-emp-id', roles: ['HR_ADMIN'],
  departmentId: 'dev-dept-id', teamId: null, channel: ChannelType.WEB, iat: 0, exp: 9999999999,
};
import { Roles } from "../../../common/decorators/roles.decorator";
import { RbacGuard } from "../../../common/guards/rbac.guard";
import { SharedJwtGuard } from "../../../common/guards/shared-jwt.guard";
import { CreatePositionDto } from "./dto/create-position.dto";
import { PositionQueryDto } from "./dto/position-query.dto";
import { UpdatePositionDto } from "./dto/update-position.dto";
import { PositionsService } from "./positions.service";

@Controller("positions")
// @UseGuards(SharedJwtGuard, RbacGuard) // TODO: re-enable when IAM module is implemented
@ApiTags("Organization - Positions")
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Post()
  @Roles("HR_ADMIN")
  @ApiOperation({ summary: "Create position" })
  create(@Body() createPositionDto: CreatePositionDto) {
    return this.positionsService.create(createPositionDto);
  }

  @Get()
  @Roles("EMPLOYEE", "MANAGER", "HR_ADMIN", "EXECUTIVE")
  @ApiOperation({ summary: "List positions" })
  findAll(@Query() query: PositionQueryDto, @CurrentUser() user?: JwtPayload) {
    return this.positionsService.findAll(query, (user ?? DEV_USER).roles);
  }

  @Get(":id")
  @Roles("EMPLOYEE", "MANAGER", "HR_ADMIN", "EXECUTIVE")
  @ApiOperation({ summary: "Get position by id" })
  findById(@Param("id") id: string) {
    return this.positionsService.findById(id);
  }

  @Patch(":id")
  @Roles("HR_ADMIN")
  @ApiOperation({ summary: "Update position" })
  update(
    @Param("id") id: string,
    @Body() updatePositionDto: UpdatePositionDto,
  ) {
    return this.positionsService.update(id, updatePositionDto);
  }

  @Delete(":id")
  @Roles("HR_ADMIN")
  @ApiOperation({ summary: "Deactivate position" })
  deactivate(@Param("id") id: string) {
    return this.positionsService.deactivate(id);
  }
}
