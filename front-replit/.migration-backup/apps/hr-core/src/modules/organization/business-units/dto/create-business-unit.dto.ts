import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, MaxLength } from 'class-validator';

export class CreateBusinessUnitDto {
  @ApiProperty({ example: 'North Africa Division', minLength: 1, maxLength: 100 })
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiProperty({ example: '12 Rue Didouche Mourad, Algiers', maxLength: 500 })
  @IsString()
  @MaxLength(500)
  address!: string;
}
