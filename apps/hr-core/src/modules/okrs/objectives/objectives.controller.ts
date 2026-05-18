import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { JwtPayload, RbacGuard, Roles, SharedJwtGuard } from '@sentient/shared';

import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CreateObjectiveDto } from '../dto/objectives/create-objective.dto';
import { ObjectiveQueryDto } from '../dto/objectives/objective-query.dto';
import { UpdateObjectiveDto } from '../dto/objectives/update-objective.dto';
import { ObjectiveResponseDto } from '../dto/response/objective-response.dto';
import {
  ObjectivesService,
  ObjectiveListResult,
  ObjectiveDetailResult,
} from './objectives.service';

@Controller('objectives')
@UseGuards(SharedJwtGuard, RbacGuard)
@ApiTags('Objectives')
export class ObjectivesController {
  constructor(private readonly objectivesService: ObjectivesService) {}

  @Post()
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'Create an Objective (level-dependent RBAC enforced in service)' })
  @ApiResponse({ status: 201, type: ObjectiveResponseDto })
  @ApiResponse({ status: 400, description: 'CycleNotActive | ParentNotFound | ParentWrongLevel | ParentNotActive | CrossDepartmentAlignment | LevelMismatch' })
  async create(
    @Body() dto: CreateObjectiveDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ObjectiveResponseDto> {
    return this.objectivesService.create(dto, user);
  }

  @Get()
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'List Objectives with scope filtering and cursor pagination' })
  @ApiResponse({ status: 200 })
  async list(
    @Query() query: ObjectiveQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ObjectiveListResult> {
    return this.objectivesService.list(query, user);
  }

  @Get(':id')
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'Get Objective with KRs and alignment context' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'Not found or outside scope' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ObjectiveDetailResult> {
    return this.objectivesService.findOneWithKrsAndAlignment(id, user);
  }

  @Patch(':id')
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update Objective title/description/status' })
  @ApiResponse({ status: 200, type: ObjectiveResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateObjectiveDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ObjectiveResponseDto> {
    return this.objectivesService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete (cancel) an Objective with cascade to KRs and check-ins' })
  @ApiResponse({ status: 204 })
  async softDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.objectivesService.softDelete(id, user);
  }
}
