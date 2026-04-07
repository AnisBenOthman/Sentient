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
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtPayload } from "@sentient/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { RbacGuard } from "../../../common/guards/rbac.guard";
import { SharedJwtGuard } from "../../../common/guards/shared-jwt.guard";
import { DepartmentsService } from "./departments.service";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { DepartmentQueryDto } from "./dto/department-query.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";

@Controller("departments")
@UseGuards(SharedJwtGuard, RbacGuard)
@ApiTags("Organization - Departments")
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @Roles("HR_ADMIN")
  @ApiOperation({ summary: "Create a department" })
  create(@Body() createDepartmentDto: CreateDepartmentDto) {
    return this.departmentsService.create(createDepartmentDto);
  }

  @Get()
  @Roles("HR_ADMIN", "EXECUTIVE")
  @ApiOperation({ summary: "List departments" })
  findAll(@Query() query: DepartmentQueryDto, @CurrentUser() user: JwtPayload) {
    return this.departmentsService.findAll(query, user.roles);
  }

  @Get(":id")
  @Roles("HR_ADMIN", "EXECUTIVE", "MANAGER")
  @ApiOperation({ summary: "Get department by id" })
  findById(@Param("id") id: string) {
    return this.departmentsService.findById(id);
  }

  @Patch(":id")
  @Roles("HR_ADMIN")
  @ApiOperation({ summary: "Update department" })
  update(
    @Param("id") id: string,
    @Body() updateDepartmentDto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(id, updateDepartmentDto);
  }

  @Delete(":id")
  @Roles("HR_ADMIN")
  @ApiOperation({ summary: "Deactivate department" })
  @ApiResponse({ status: 200, description: "Department soft-deactivated" })
  deactivate(@Param("id") id: string) {
    return this.departmentsService.deactivate(id);
  }
}
