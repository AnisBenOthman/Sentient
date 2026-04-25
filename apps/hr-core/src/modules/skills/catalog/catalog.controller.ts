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
import { RbacGuard, Roles, SharedJwtGuard } from '@sentient/shared';
import { Skill } from '../../../generated/prisma';
import { UserStatusGuard } from '../../iam/guards/user-status.guard';
import { CreateSkillDto } from '../dto/create-skill.dto';
import { SkillQueryDto } from '../dto/skill-query.dto';
import { UpdateSkillDto } from '../dto/update-skill.dto';
import { CatalogService, PaginatedSkills } from './catalog.service';

@Controller('skills')
@UseGuards(SharedJwtGuard, UserStatusGuard, RbacGuard)
@ApiTags('Skills Catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post()
  @Roles('HR_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new skill in the catalog' })
  @ApiResponse({ status: 201, description: 'Skill created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Skill name already exists (case-insensitive)' })
  async create(@Body() dto: CreateSkillDto): Promise<Skill> {
    return this.catalogService.create(dto);
  }

  @Get()
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'List catalog skills with filtering and pagination' })
  @ApiResponse({ status: 200, description: '{ data: Skill[], total, page, limit }' })
  async findAll(@Query() query: SkillQueryDto): Promise<PaginatedSkills> {
    return this.catalogService.findAll(query);
  }

  @Get(':id')
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'Get a single catalog skill by ID' })
  @ApiResponse({ status: 200, description: 'Skill object' })
  @ApiResponse({ status: 404, description: 'Skill not found' })
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<Skill> {
    return this.catalogService.findById(id);
  }

  @Patch(':id')
  @Roles('HR_ADMIN')
  @ApiOperation({ summary: 'Edit catalog skill entry (name, category, description)' })
  @ApiResponse({ status: 200, description: 'Updated skill object' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Skill not found' })
  @ApiResponse({ status: 409, description: 'Name collision (case-insensitive)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSkillDto,
  ): Promise<Skill> {
    return this.catalogService.update(id, dto);
  }
}
