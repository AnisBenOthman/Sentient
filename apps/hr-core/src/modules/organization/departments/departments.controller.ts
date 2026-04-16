import {
  Body,
  Controller,
  Delete,
  Get,
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
import { DepartmentsService } from "./departments.service";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { DepartmentQueryDto } from "./dto/department-query.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";

@Controller("departments")
// @UseGuards(SharedJwtGuard, RbacGuard) // TODO: re-enable when IAM module is implemented
@ApiTags("Organization - Departments")
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  // @Roles("HR_ADMIN") // TODO: re-enable when IAM module is implemented
  @ApiOperation({ summary: "Create a department" })
  create(@Body() createDepartmentDto: CreateDepartmentDto) {
    return this.departmentsService.create(createDepartmentDto);
  }

  @Get()
  // @Roles("HR_ADMIN", "EXECUTIVE") // TODO: re-enable when IAM module is implemented
  @ApiOperation({ summary: "List departments" })
  findAll(@Query() query: DepartmentQueryDto, @CurrentUser() user?: JwtPayload) {
    return this.departmentsService.findAll(query, (user ?? DEV_USER).roles);
  }

  @Get(":id")
  // @Roles("HR_ADMIN", "EXECUTIVE", "MANAGER") // TODO: re-enable when IAM module is implemented
  @ApiOperation({ summary: "Get department by id" })
  findById(@Param("id") id: string) {
    return this.departmentsService.findById(id);
  }

  @Patch(":id")
  // @Roles("HR_ADMIN") // TODO: re-enable when IAM module is implemented
  @ApiOperation({ summary: "Update department" })
  update(
    @Param("id") id: string,
    @Body() updateDepartmentDto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(id, updateDepartmentDto);
  }

  @Delete(":id")
  // @Roles("HR_ADMIN") // TODO: re-enable when IAM module is implemented
  @ApiOperation({ summary: "Deactivate department" })
  @ApiResponse({ status: 200, description: "Department soft-deactivated" })
  deactivate(@Param("id") id: string) {
    return this.departmentsService.deactivate(id);
  }
}
