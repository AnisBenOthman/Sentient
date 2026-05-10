import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PermissionScope } from '@sentient/shared';

export class AssignRoleDto {
  @ApiProperty({ description: 'Role UUID to assign' })
  @IsUUID()
  roleId!: string;

  @ApiProperty({ enum: PermissionScope })
  @IsEnum(PermissionScope)
  scope!: PermissionScope;

  @ApiPropertyOptional({ description: 'Team / Department / BusinessUnit UUID for scoped assignments' })
  @IsOptional()
  @IsUUID()
  scopeEntityId?: string;
}
