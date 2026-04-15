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
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ChannelType, JwtPayload } from '@sentient/shared';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

const DEV_USER: JwtPayload = {
  sub: 'dev-user-id', employeeId: 'dev-emp-id', roles: ['HR_ADMIN'],
  departmentId: 'dev-dept-id', teamId: null, channel: ChannelType.WEB, iat: 0, exp: 9999999999,
};
import { Roles } from '../../../common/decorators/roles.decorator';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { SharedJwtGuard } from '../../../common/guards/shared-jwt.guard';
import { BusinessUnitsService } from './business-units.service';
import { BusinessUnitQueryDto } from './dto/business-unit-query.dto';
import { CreateBusinessUnitDto } from './dto/create-business-unit.dto';
import { UpdateBusinessUnitDto } from './dto/update-business-unit.dto';

@Controller('business-units')
// @UseGuards(SharedJwtGuard, RbacGuard) // TODO: re-enable when IAM module is implemented
@ApiTags('Organization - Business Units')
export class BusinessUnitsController {
  constructor(private readonly businessUnitsService: BusinessUnitsService) {}

  @Post()
  @Roles('HR_ADMIN')
  @ApiOperation({ summary: 'Create a business unit' })
  @ApiResponse({ status: 201, description: 'Business unit created' })
  @ApiResponse({ status: 409, description: 'Name already exists' })
  create(@Body() dto: CreateBusinessUnitDto) {
    return this.businessUnitsService.create(dto);
  }

  @Get()
  @Roles('HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'List business units (cursor-based)' })
  findAll(@Query() query: BusinessUnitQueryDto, @CurrentUser() user?: JwtPayload) {
    return this.businessUnitsService.findAll(query, (user ?? DEV_USER).roles);
  }

  @Get(':id')
  @Roles('HR_ADMIN', 'EXECUTIVE', 'MANAGER')
  @ApiOperation({ summary: 'Get a business unit by id' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findById(@Param('id') id: string) {
    return this.businessUnitsService.findById(id);
  }

  @Patch(':id')
  @Roles('HR_ADMIN')
  @ApiOperation({ summary: 'Update a business unit' })
  update(@Param('id') id: string, @Body() dto: UpdateBusinessUnitDto) {
    return this.businessUnitsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('HR_ADMIN')
  @ApiOperation({ summary: 'Deactivate a business unit (soft delete)' })
  deactivate(@Param('id') id: string) {
    return this.businessUnitsService.deactivate(id);
  }
}
