import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RbacGuard, Roles, SharedJwtGuard } from '@sentient/shared';
import { UserStatusGuard } from '../../iam/guards/user-status.guard';
import { BulkReplacePositionSkillsDto } from './dto/bulk-replace-position-skills.dto';
import { PositionSkillQueryDto } from './dto/position-skill-query.dto';
import { UpsertPositionSkillDto } from './dto/upsert-position-skill.dto';
import { PositionSkillWithSkill, PositionSkillsService } from './position-skills.service';

@Controller('positions/:positionId/skills')
@UseGuards(SharedJwtGuard, UserStatusGuard, RbacGuard)
@ApiTags('Organization - Position Skills')
export class PositionSkillsController {
  constructor(private readonly positionSkillsService: PositionSkillsService) {}

  @Get()
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'List required skills for a position' })
  findForPosition(
    @Param('positionId', ParseUUIDPipe) positionId: string,
    @Query() query: PositionSkillQueryDto,
  ): Promise<PositionSkillWithSkill[]> {
    return this.positionSkillsService.findForPosition(positionId, query);
  }

  @Post()
  @Roles('HR_ADMIN')
  @ApiOperation({ summary: 'Add or update a required skill for a position' })
  upsert(
    @Param('positionId', ParseUUIDPipe) positionId: string,
    @Body() dto: UpsertPositionSkillDto,
  ): Promise<PositionSkillWithSkill> {
    return this.positionSkillsService.upsert(positionId, dto);
  }

  @Put()
  @Roles('HR_ADMIN')
  @ApiOperation({
    summary: 'Replace the full required-skills set for a position',
    description: 'Transactionally replaces all required skills. Send an empty skills array to clear all requirements.',
  })
  bulkReplace(
    @Param('positionId', ParseUUIDPipe) positionId: string,
    @Body() dto: BulkReplacePositionSkillsDto,
  ): Promise<PositionSkillWithSkill[]> {
    return this.positionSkillsService.bulkReplace(positionId, dto);
  }

  @Delete(':skillId')
  @Roles('HR_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a required skill from a position' })
  remove(
    @Param('positionId', ParseUUIDPipe) positionId: string,
    @Param('skillId', ParseUUIDPipe) skillId: string,
  ): Promise<void> {
    return this.positionSkillsService.remove(positionId, skillId);
  }
}
