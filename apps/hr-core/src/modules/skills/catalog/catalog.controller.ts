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
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Skill } from '../../../generated/prisma';
// import { Roles } from '../../../common/decorators/roles.decorator'; // TODO: re-enable when IAM module is implemented
// import { RbacGuard } from '../../../common/guards/rbac.guard'; // TODO: re-enable when IAM module is implemented
// import { SharedJwtGuard } from '../../../common/guards/shared-jwt.guard'; // TODO: re-enable when IAM module is implemented
import { CreateSkillDto } from '../dto/create-skill.dto';
import { SkillQueryDto } from '../dto/skill-query.dto';
import { UpdateSkillDto } from '../dto/update-skill.dto';
import { CatalogService, PaginatedSkills } from './catalog.service';

@Controller('skills')
// @UseGuards(SharedJwtGuard, RbacGuard) // TODO: re-enable when IAM module is implemented
@ApiTags('Skills Catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post()
  // @Roles('HR_ADMIN') // TODO: re-enable when IAM module is implemented
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new skill in the catalog' })
  @ApiResponse({ status: 201, description: 'Skill created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Skill name already exists (case-insensitive)' })
  async create(@Body() dto: CreateSkillDto): Promise<Skill> {
    return this.catalogService.create(dto);
  }

  @Get()
  // @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE') // TODO: re-enable when IAM module is implemented
  @ApiOperation({ summary: 'List catalog skills with filtering and pagination' })
  @ApiResponse({ status: 200, description: '{ data: Skill[], total, page, limit }' })
  async findAll(@Query() query: SkillQueryDto): Promise<PaginatedSkills> {
    return this.catalogService.findAll(query);
  }

  @Get(':id')
  // @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE') // TODO: re-enable when IAM module is implemented
  @ApiOperation({ summary: 'Get a single catalog skill by ID' })
  @ApiResponse({ status: 200, description: 'Skill object' })
  @ApiResponse({ status: 404, description: 'Skill not found' })
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<Skill> {
    return this.catalogService.findById(id);
  }

  @Patch(':id')
  // @Roles('HR_ADMIN') // TODO: re-enable when IAM module is implemented
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
