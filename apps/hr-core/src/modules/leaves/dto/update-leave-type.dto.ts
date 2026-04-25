import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateLeaveTypeDto } from './create-leave-type.dto';

export class UpdateLeaveTypeDto extends PartialType(
  OmitType(CreateLeaveTypeDto, ['businessUnitId', 'accrualFrequency'] as const),
) {}
