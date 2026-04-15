import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateBusinessUnitDto } from './create-business-unit.dto';

export class UpdateBusinessUnitDto extends PartialType(CreateBusinessUnitDto) {
  @ApiPropertyOptional({ description: 'Soft activate / deactivate' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
