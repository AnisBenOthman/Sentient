import { ApiProperty } from '@nestjs/swagger';
import { IsHexadecimal, IsString, Length, Matches, MinLength } from 'class-validator';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
const PASSWORD_MSG =
  'Password must be at least 8 characters and contain uppercase, lowercase, digit, and special character.';

export class ClaimInviteDto {
  @ApiProperty({ description: 'Invite token from the email link' })
  @IsString()
  @IsHexadecimal()
  @Length(64, 64)
  token!: string;

  @ApiProperty({ description: PASSWORD_MSG })
  @IsString()
  @MinLength(8)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MSG })
  newPassword!: string;
}
