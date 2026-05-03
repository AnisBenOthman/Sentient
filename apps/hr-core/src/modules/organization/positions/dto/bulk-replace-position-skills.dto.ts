import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { UpsertPositionSkillDto } from './upsert-position-skill.dto';

export class BulkReplacePositionSkillsDto {
  @ApiProperty({
    type: [UpsertPositionSkillDto],
    description: 'Complete replacement set for the position. Sending an empty array clears all required skills.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertPositionSkillDto)
  skills!: UpsertPositionSkillDto[];
}
