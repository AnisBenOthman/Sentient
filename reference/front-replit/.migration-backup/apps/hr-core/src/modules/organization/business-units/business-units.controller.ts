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
import { JwtPayload, RbacGuard, Roles, SharedJwtGuard } from '@sentient/shared';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { UserStatusGuard } from '../../iam/guards/user-status.guard';
import { BusinessUnitsService } from './business-units.service';
import { BusinessUnitQueryDto } from './dto/business-unit-query.dto';
import { CreateBusinessUnitDto } from './dto/create-business-unit.dto';
import { UpdateBusinessUnitDto } from './dto/update-business-unit.dto';

@Controller('business-units')
@UseGuards(SharedJwtGuard, UserStatusGuard, RbacGuard)
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
  findAll(@Query() query: BusinessUnitQueryDto, @CurrentUser() user: JwtPayload) {
    return this.businessUnitsService.findAll(query, user.roles);
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
