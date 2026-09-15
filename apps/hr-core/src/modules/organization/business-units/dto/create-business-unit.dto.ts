import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches, MaxLength } from 'class-validator';

export class CreateBusinessUnitDto {
  @ApiProperty({ example: 'North Africa Division', minLength: 1, maxLength: 100 })
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiProperty({ example: '12 Rue Didouche Mourad, Algiers', maxLength: 500 })
  @IsString()
  @MaxLength(500)
  address!: string;

  @ApiProperty({ example: 'DZD', minLength: 3, maxLength: 3 })
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter uppercase ISO currency code' })
  currency!: string;
}
