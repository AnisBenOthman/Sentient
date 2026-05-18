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
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { JwtPayload, RbacGuard, Roles, SharedJwtGuard } from '@sentient/shared';

import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CreateKeyResultDto } from '../dto/key-results/create-key-result.dto';
import { UpdateKeyResultDto } from '../dto/key-results/update-key-result.dto';
import { KeyResultResponseDto } from '../dto/response/key-result-response.dto';
import { KeyResultsService, KeyResultListResult } from './key-results.service';

@Controller('key-results')
@UseGuards(SharedJwtGuard, RbacGuard)
@ApiTags('Key Results')
export class KeyResultsController {
  constructor(private readonly keyResultsService: KeyResultsService) {}

  @Post()
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN')
  @ApiOperation({ summary: 'Create a Key Result under an Objective' })
  @ApiResponse({ status: 201, type: KeyResultResponseDto })
  @ApiResponse({ status: 400, description: 'ObjectiveNotActive | BooleanTargetMustBeOne | TargetMustBePositive | AssigneeNotFound' })
  async create(
    @Body() dto: CreateKeyResultDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<KeyResultResponseDto> {
    return this.keyResultsService.create(dto, user);
  }

  @Patch(':id')
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update Key Result target/assignees/status' })
  @ApiResponse({ status: 200, type: KeyResultResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKeyResultDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<KeyResultResponseDto> {
    return this.keyResultsService.update(id, dto, user);
  }

  @Get('objective/:objectiveId')
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'List Key Results for an Objective' })
  @ApiResponse({ status: 200 })
  async listByObjective(
    @Param('objectiveId', ParseUUIDPipe) objectiveId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<KeyResultListResult> {
    return this.keyResultsService.listByObjective(objectiveId, user);
  }
}
