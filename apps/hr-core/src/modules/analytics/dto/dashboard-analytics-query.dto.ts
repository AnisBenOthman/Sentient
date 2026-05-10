import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class DashboardAnalyticsQueryDto {
  @IsOptional()
  @IsIn(['global', 'bu', 'dept', 'team'])
  level?: 'global' | 'bu' | 'dept' | 'team';

  @IsOptional()
  @IsUUID()
  businessUnitId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;
}
