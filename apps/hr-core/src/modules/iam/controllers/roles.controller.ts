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
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload, RbacGuard, Roles, SharedJwtGuard } from '@sentient/shared';
import { Permission, Role } from '../../../generated/prisma';
import { UserStatusGuard } from '../guards/user-status.guard';
import { CreateRoleDto } from '../dto/create-role.dto';
import { RolesService, RoleWithPermissions } from '../services/roles.service';

@ApiTags('Roles')
@Controller('roles')
@UseGuards(SharedJwtGuard, UserStatusGuard, RbacGuard)
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @Roles('HR_ADMIN', 'GLOBAL_HR_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'List all roles with their permissions' })
  async findAll(): Promise<RoleWithPermissions[]> {
    return this.roles.findAll();
  }

  @Get('permissions')
  @Roles('HR_ADMIN', 'GLOBAL_HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ summary: 'List the full permission catalog' })
  async findPermissions(): Promise<Permission[]> {
    return this.roles.findPermissions();
  }

  @Get(':id')
  @Roles('HR_ADMIN', 'GLOBAL_HR_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'Get role by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<RoleWithPermissions> {
    return this.roles.findById(id);
  }

  @Post()
  @Roles('GLOBAL_HR_ADMIN')
  @ApiOperation({ summary: 'Create a custom role (GLOBAL_HR_ADMIN only)' })
  @ApiResponse({ status: 201 })
  async create(@Body() dto: CreateRoleDto, @CurrentUser() actor: JwtPayload): Promise<Role> {
    return this.roles.create(dto, actor.sub);
  }

  @Delete(':id')
  @Roles('GLOBAL_HR_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a custom role' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: JwtPayload,
  ): Promise<void> {
    await this.roles.delete(id, actor.sub);
  }

  @Post(':id/permissions/:permissionId')
  @Roles('GLOBAL_HR_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Add a permission to a role' })
  async addPermission(
    @Param('id', ParseUUIDPipe) roleId: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
    @CurrentUser() actor: JwtPayload,
  ): Promise<void> {
    await this.roles.addPermission(roleId, permissionId, actor.sub);
  }

  @Delete(':id/permissions/:permissionId')
  @Roles('GLOBAL_HR_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a permission from a role' })
  async removePermission(
    @Param('id', ParseUUIDPipe) roleId: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
    @CurrentUser() actor: JwtPayload,
  ): Promise<void> {
    await this.roles.removePermission(roleId, permissionId, actor.sub);
  }
}
