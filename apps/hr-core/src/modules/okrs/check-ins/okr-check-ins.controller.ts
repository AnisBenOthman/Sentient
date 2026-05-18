import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { JwtPayload, RbacGuard, Roles, SharedJwtGuard } from '@sentient/shared';

import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RejectCheckInDto } from '../dto/check-ins/reject-check-in.dto';
import { SubmitCheckInDto } from '../dto/check-ins/submit-check-in.dto';
import { OkrCheckInResponseDto } from '../dto/response/okr-check-in-response.dto';
import { OkrCheckInsService, CheckInListResult } from './okr-check-ins.service';

@Controller('hr/okr-check-ins')
@UseGuards(SharedJwtGuard, RbacGuard)
@ApiTags('OKR Check-ins')
export class OkrCheckInsController {
  constructor(private readonly okrCheckInsService: OkrCheckInsService) {}

  @Post()
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN')
  @ApiOperation({ summary: 'Submit a check-in for an assigned Key Result' })
  @ApiResponse({ status: 201, type: OkrCheckInResponseDto })
  @ApiResponse({ status: 400, description: 'KrNotFound | NotAssigned | KrNotActive | BooleanValueInvalid' })
  async submit(
    @Body() dto: SubmitCheckInDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<OkrCheckInResponseDto> {
    return this.okrCheckInsService.submit(dto, user);
  }

  @Get('key-result/:keyResultId')
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN')
  @ApiOperation({ summary: 'List check-ins for a Key Result' })
  @ApiResponse({ status: 200 })
  async listByKeyResult(
    @Param('keyResultId', ParseUUIDPipe) keyResultId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<CheckInListResult> {
    return this.okrCheckInsService.listByKeyResult(keyResultId, user);
  }

  @Patch(':id/approve')
  @Roles('MANAGER', 'HR_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a PENDING check-in; updates KR currentValue and score' })
  @ApiResponse({ status: 200, type: OkrCheckInResponseDto })
  @ApiResponse({ status: 409, description: 'CheckInNotPending' })
  @ApiResponse({ status: 403, description: 'WrongDepartment' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<OkrCheckInResponseDto> {
    return this.okrCheckInsService.approve(id, user);
  }

  @Patch(':id/reject')
  @Roles('MANAGER', 'HR_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a PENDING check-in with a required reason' })
  @ApiResponse({ status: 200, type: OkrCheckInResponseDto })
  @ApiResponse({ status: 409, description: 'CheckInNotPending' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectCheckInDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<OkrCheckInResponseDto> {
    return this.okrCheckInsService.reject(id, dto, user);
  }
}
