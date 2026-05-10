import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RbacGuard, Roles, SharedJwtGuard } from '@sentient/shared';
import { Holiday } from '../../../generated/prisma';
import { UserStatusGuard } from '../../iam/guards/user-status.guard';
import { CreateHolidayDto } from '../dto/create-holiday.dto';
import { UpdateHolidayDto } from '../dto/update-holiday.dto';
import { HolidayQueryDto, HolidaysService } from './holidays.service';

@Controller('holidays')
@UseGuards(SharedJwtGuard, UserStatusGuard, RbacGuard)
@ApiTags('Leave Management')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Get()
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN')
  @ApiOperation({ summary: 'List holidays for a business unit and/or year' })
  @ApiResponse({ status: 200, description: 'List of holidays' })
  async findAll(@Query() query: HolidayQueryDto): Promise<Holiday[]> {
    return this.holidaysService.findAll(query);
  }

  @Post()
  @Roles('HR_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a holiday for a business unit' })
  @ApiResponse({ status: 201, description: 'Holiday created' })
  @ApiResponse({ status: 409, description: 'DuplicateHoliday' })
  async create(@Body() dto: CreateHolidayDto): Promise<Holiday> {
    return this.holidaysService.create(dto);
  }

  @Patch(':id')
  @Roles('HR_ADMIN')
  @ApiOperation({ summary: 'Update a holiday' })
  @ApiResponse({ status: 200, description: 'Holiday updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHolidayDto,
  ): Promise<Holiday> {
    return this.holidaysService.update(id, dto);
  }

  @Delete(':id')
  @Roles('HR_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a holiday' })
  @ApiResponse({ status: 204, description: 'Holiday deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.holidaysService.delete(id);
  }
}
