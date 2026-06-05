import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@sentient/shared';
import { GovernanceActivityResponse, GovernanceService } from './governance.service';

@ApiTags('AI Governance')
@ApiBearerAuth()
@Controller('governance')
export class GovernanceController {
  constructor(private readonly governance: GovernanceService) {}

  @Get('agent-activity')
  @Roles('HR_ADMIN', 'EXECUTIVE', 'SYSTEM_ADMIN')
  @ApiOperation({ summary: 'Aggregate supervisor and specialist activity' })
  @ApiOkResponse({ description: 'Aggregate usage and safety metrics' })
  getActivity(): Promise<GovernanceActivityResponse> {
    return this.governance.getActivity();
  }
}
