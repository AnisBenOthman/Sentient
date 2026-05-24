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
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload, RbacGuard, Roles, SharedJwtGuard } from '@sentient/shared';
import { User } from '../../../generated/prisma';
import { UserStatusGuard } from '../guards/user-status.guard';
import { AssignRoleDto } from '../dto/assign-role.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserStatusDto } from '../dto/update-user-status.dto';
import { InviteService } from '../services/invite.service';
import { RolesService } from '../services/roles.service';
import { UsersService } from '../services/users.service';
import { Argon2Service } from '../services/argon2.service';

@ApiTags('Users')
@Controller('users')
@UseGuards(SharedJwtGuard, UserStatusGuard, RbacGuard)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly roles: RolesService,
    private readonly argon2: Argon2Service,
    private readonly statusGuard: UserStatusGuard,
    private readonly invite: InviteService,
  ) {}

  @Post()
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN', 'GLOBAL_HR_ADMIN')
  @ApiOperation({ summary: 'Provision a new user account and send invite email' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async create(@Body() dto: CreateUserDto): Promise<User> {
    const user = await this.users.create(dto);
    await this.invite.issue(user.id, user.email);
    return user;
  }

  @Post(':id/resend-invite')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN', 'GLOBAL_HR_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Resend invite email to a pending user' })
  @ApiResponse({ status: 204, description: 'Invite re-sent' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'User has already activated their account' })
  async resendInvite(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.invite.resend(id);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200 })
  async me(@CurrentUser() user: JwtPayload): Promise<User> {
    return this.users.findById(user.sub);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change own password' })
  async changePassword(
    @CurrentUser() currentUser: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    const dbUser = await this.users.findById(currentUser.sub);
    const valid = await this.argon2.verify(dbUser.passwordHash, dto.currentPassword);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const history = dbUser.passwordHistory as string[];
    await this.users.changePassword(currentUser.sub, dto.newPassword, history);
  }

  @Patch(':id/status')
  @Roles('SYSTEM_ADMIN', 'GLOBAL_HR_ADMIN')
  @ApiOperation({ summary: 'Update user status (activate / disable / unlock)' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<User> {
    const user = await this.users.updateStatus(id, dto.status);
    this.statusGuard.invalidate(id);
    return user;
  }

  @Post(':id/roles')
  @Roles('SYSTEM_ADMIN', 'GLOBAL_HR_ADMIN', 'HR_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Assign a role to a user' })
  async assignRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() actor: JwtPayload,
  ): Promise<void> {
    await this.roles.assignToUser(id, dto.roleId, dto.scope, dto.scopeEntityId ?? null, actor.sub);
  }

  @Delete(':userId/roles/:userRoleId')
  @Roles('SYSTEM_ADMIN', 'GLOBAL_HR_ADMIN', 'HR_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a role assignment from a user' })
  async revokeRole(
    @Param('userRoleId', ParseUUIDPipe) userRoleId: string,
    @CurrentUser() actor: JwtPayload,
  ): Promise<void> {
    await this.roles.revokeFromUser(userRoleId, actor.sub);
  }
}
