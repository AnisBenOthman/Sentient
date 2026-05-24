import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PermissionScope, SecurityEventType } from '@sentient/shared';
import { Permission, Prisma, Role, PermissionScope as PrismaPermissionScope } from '../../../generated/prisma';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateRoleDto } from '../dto/create-role.dto';
import { AuditService } from './audit.service';

export interface RoleWithPermissions extends Role {
  rolePermissions: { permission: Permission }[];
}

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(): Promise<RoleWithPermissions[]> {
    return this.prisma.role.findMany({
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { code: 'asc' },
    }) as Promise<RoleWithPermissions[]>;
  }

  async findById(id: string): Promise<RoleWithPermissions> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { rolePermissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException(`Role ${id} not found`);
    return role as RoleWithPermissions;
  }

  async create(dto: CreateRoleDto, actorId: string): Promise<Role> {
    const existing = await this.prisma.role.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`Role code '${dto.code}' already exists`);

    const role = await this.prisma.role.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        isSystem: false,
        isEditable: true,
        ...(dto.permissionIds?.length
          ? {
              rolePermissions: {
                create: dto.permissionIds.map((pid) => ({ permissionId: pid })),
              },
            }
          : {}),
      },
    });

    this.audit.log(actorId, SecurityEventType.ROLE_CREATED, {
      metadata: { roleId: role.id, roleCode: role.code },
    });
    return role;
  }

  async delete(id: string, actorId: string): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException(`Role ${id} not found`);
    if (!role.isEditable) throw new ForbiddenException('System roles cannot be deleted');

    const assignments = await this.prisma.userRole.count({ where: { roleId: id, revokedAt: null } });
    if (assignments > 0) {
      throw new BadRequestException('Cannot delete a role with active assignments');
    }

    await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
    await this.prisma.role.delete({ where: { id } });

    this.audit.log(actorId, SecurityEventType.ROLE_DELETED, {
      metadata: { roleId: id, roleCode: role.code },
    });
  }

  async addPermission(roleId: string, permissionId: string, actorId: string): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException(`Role ${roleId} not found`);
    if (!role.isEditable) throw new ForbiddenException('This role is not editable');

    await this.prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      update: {},
      create: { roleId, permissionId },
    });

    this.audit.log(actorId, SecurityEventType.ROLE_PERMISSION_ADDED, {
      metadata: { roleId, permissionId },
    });
  }

  async removePermission(roleId: string, permissionId: string, actorId: string): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException(`Role ${roleId} not found`);
    if (!role.isEditable) throw new ForbiddenException('This role is not editable');

    await this.prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId, permissionId } },
    });

    this.audit.log(actorId, SecurityEventType.ROLE_PERMISSION_REMOVED, {
      metadata: { roleId, permissionId },
    });
  }

  async assignToUser(
    userId: string,
    roleId: string,
    scope: PermissionScope,
    scopeEntityId: string | null,
    actorId: string,
  ): Promise<void> {
    try {
      await this.prisma.userRole.create({
        // WHY: Both PermissionScope enums share identical string values; cast bridges
        // the shared-package type to the Prisma-generated enum at the DB boundary.
        data: { userId, roleId, scope: scope as unknown as PrismaPermissionScope, scopeEntityId, assignedById: actorId },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2003') throw new NotFoundException('User or role not found');
        if (e.code === 'P2002') throw new ConflictException('This role is already assigned to the user with the same scope');
      }
      throw e;
    }
    this.audit.log(actorId, SecurityEventType.ROLE_ASSIGNED, {
      metadata: { userId, roleId, scope, scopeEntityId },
    });
  }

  async revokeFromUser(userRoleId: string, actorId: string): Promise<void> {
    const ur = await this.prisma.userRole.findUnique({ where: { id: userRoleId } });
    if (!ur) throw new NotFoundException(`UserRole ${userRoleId} not found`);

    await this.prisma.userRole.update({
      where: { id: userRoleId },
      data: { revokedAt: new Date(), revokedById: actorId },
    });
    this.audit.log(actorId, SecurityEventType.ROLE_REVOKED, {
      metadata: { userRoleId, userId: ur.userId, roleId: ur.roleId },
    });
  }

  async findPermissions(): Promise<Permission[]> {
    return this.prisma.permission.findMany({ orderBy: [{ resource: 'asc' }, { action: 'asc' }] });
  }
}
