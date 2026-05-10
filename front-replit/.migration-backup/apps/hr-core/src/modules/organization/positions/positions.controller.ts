import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayload, RbacGuard, Roles, SharedJwtGuard } from '@sentient/shared';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { UserStatusGuard } from '../../iam/guards/user-status.guard';
import { CreatePositionDto } from './dto/create-position.dto';
import { PositionQueryDto } from './dto/position-query.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { CursorPage, PositionsService } from './positions.service';
import { Position } from '../../../generated/prisma';

@Controller('positions')
@UseGuards(SharedJwtGuard, UserStatusGuard, RbacGuard)
@ApiTags('Organization - Positions')
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Post()
  @Roles('HR_ADMIN')
  @ApiOperation({ summary: 'Create position' })
  create(@Body() createPositionDto: CreatePositionDto) {
    return this.positionsService.create(createPositionDto);
  }

  @Get()
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'List positions' })
  findAll(@Query() query: PositionQueryDto, @CurrentUser() user: JwtPayload) {
    return this.positionsService.findAll(query, user.roles);
  }

  @Get('key')
  @Roles('MANAGER', 'HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'List all active key positions' })
  findKeyPositions(): Promise<CursorPage<Position>> {
    return this.positionsService.findAll(
      { isKeyPosition: true, limit: 200 },
      ['HR_ADMIN'],
    );
  }

  @Get(':id')
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'Get position by id' })
  findById(@Param('id') id: string) {
    return this.positionsService.findById(id);
  }

  @Patch(':id')
  @Roles('HR_ADMIN')
  @ApiOperation({ summary: 'Update position' })
  update(
    @Param('id') id: string,
    @Body() updatePositionDto: UpdatePositionDto,
  ) {
    return this.positionsService.update(id, updatePositionDto);
  }

  @Delete(':id')
  @Roles('HR_ADMIN')
  @ApiOperation({ summary: 'Deactivate position' })
  deactivate(@Param('id') id: string) {
    return this.positionsService.deactivate(id);
  }
}
