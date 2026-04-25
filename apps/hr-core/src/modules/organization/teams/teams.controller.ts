import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { CreateTeamDto } from './dto/create-team.dto';
import { TeamQueryDto } from './dto/team-query.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TeamsService } from './teams.service';

@Controller('teams')
@UseGuards(SharedJwtGuard, UserStatusGuard, RbacGuard)
@ApiTags('Organization - Teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  @Roles('HR_ADMIN')
  @ApiOperation({ summary: 'Create a team' })
  create(@Body() createTeamDto: CreateTeamDto) {
    return this.teamsService.create(createTeamDto);
  }

  @Get()
  @Roles('HR_ADMIN', 'EXECUTIVE', 'MANAGER')
  @ApiOperation({ summary: 'List teams' })
  findAll(@Query() query: TeamQueryDto, @CurrentUser() user: JwtPayload) {
    return this.teamsService.findAll(query, user);
  }

  @Get(':id')
  @Roles('HR_ADMIN', 'EXECUTIVE', 'MANAGER')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get team by id' })
  @ApiResponse({ status: 403, description: 'Manager accessing another team' })
  findById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.teamsService.findById(id, user);
  }

  @Patch(':id')
  @Roles('HR_ADMIN')
  @ApiOperation({ summary: 'Update a team' })
  update(@Param('id') id: string, @Body() updateTeamDto: UpdateTeamDto) {
    return this.teamsService.update(id, updateTeamDto);
  }

  @Delete(':id')
  @Roles('HR_ADMIN')
  @ApiOperation({ summary: 'Deactivate a team' })
  deactivate(@Param('id') id: string) {
    return this.teamsService.deactivate(id);
  }
}
