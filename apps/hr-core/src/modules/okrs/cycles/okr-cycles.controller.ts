import {
  Body,
  Controller,
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
import { CreateOkrCycleDto } from '../dto/cycles/create-okr-cycle.dto';
import { OkrCycleQueryDto } from '../dto/cycles/okr-cycle-query.dto';
import { OkrCycleResponseDto } from '../dto/response/okr-cycle-response.dto';
import { OkrCyclesService, OkrCycleListResult } from './okr-cycles.service';

@Controller('okr-cycles')
@UseGuards(SharedJwtGuard, RbacGuard)
@ApiTags('OKR Cycles')
export class OkrCyclesController {
  constructor(private readonly okrCyclesService: OkrCyclesService) {}

  @Post()
  @Roles('HR_ADMIN')
  @ApiOperation({ summary: 'Create an OKR cycle (DRAFT)' })
  @ApiResponse({ status: 201, type: OkrCycleResponseDto })
  @ApiResponse({ status: 400, description: 'CycleNameTaken | InvalidQuarter | ParentMustBeAnnual | EndBeforeStart' })
  @ApiResponse({ status: 403, description: 'Forbidden — HR_ADMIN role required' })
  async create(
    @Body() dto: CreateOkrCycleDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<OkrCycleResponseDto> {
    return this.okrCyclesService.create(dto, user);
  }

  @Get()
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'List OKR cycles with cursor pagination' })
  @ApiResponse({ status: 200 })
  async list(
    @Query() query: OkrCycleQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<OkrCycleListResult> {
    return this.okrCyclesService.list(query, user);
  }

  @Patch(':id/activate')
  @Roles('HR_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transition cycle DRAFT → ACTIVE' })
  @ApiResponse({ status: 200, type: OkrCycleResponseDto })
  @ApiResponse({ status: 400, description: 'CycleNotDraft | EndDateInPast' })
  @ApiResponse({ status: 403, description: 'Forbidden — HR_ADMIN role required' })
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<OkrCycleResponseDto> {
    return this.okrCyclesService.activate(id, user);
  }

  @Patch(':id/close')
  @Roles('HR_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transition cycle ACTIVE → CLOSED with cascade side effects' })
  @ApiResponse({ status: 200, type: OkrCycleResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden — HR_ADMIN role required' })
  async close(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<OkrCycleResponseDto> {
    return this.okrCyclesService.close(id, user);
  }
}
