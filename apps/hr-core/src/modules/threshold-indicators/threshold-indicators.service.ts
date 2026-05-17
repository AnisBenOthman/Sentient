import { Injectable, NotFoundException } from '@nestjs/common';
import { ThresholdIndicator } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateThresholdIndicatorDto } from './dto/create-threshold-indicator.dto';
import { UpdateThresholdIndicatorDto } from './dto/update-threshold-indicator.dto';

@Injectable()
export class ThresholdIndicatorsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<ThresholdIndicator[]> {
    return this.prisma.thresholdIndicator.findMany({
      where: { isActive: true },
      orderBy: { metricKey: 'asc' },
    });
  }

  upsert(dto: CreateThresholdIndicatorDto, employeeId: string): Promise<ThresholdIndicator> {
    const { metricKey, label, warningThreshold, criticalThreshold, warningBelow, criticalBelow } = dto;
    return this.prisma.thresholdIndicator.upsert({
      where: { metricKey },
      create: {
        metricKey,
        label,
        warningThreshold: warningThreshold ?? null,
        criticalThreshold: criticalThreshold ?? null,
        warningBelow: warningBelow ?? null,
        criticalBelow: criticalBelow ?? null,
        isActive: true,
        createdBy: employeeId,
      },
      update: {
        label,
        warningThreshold: warningThreshold ?? null,
        criticalThreshold: criticalThreshold ?? null,
        warningBelow: warningBelow ?? null,
        criticalBelow: criticalBelow ?? null,
        isActive: true,
        createdBy: employeeId,
      },
    });
  }

  async update(id: string, dto: UpdateThresholdIndicatorDto): Promise<ThresholdIndicator> {
    await this.findOneOrThrow(id);
    return this.prisma.thresholdIndicator.update({
      where: { id },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.warningThreshold !== undefined && { warningThreshold: dto.warningThreshold }),
        ...(dto.criticalThreshold !== undefined && { criticalThreshold: dto.criticalThreshold }),
        ...(dto.warningBelow !== undefined && { warningBelow: dto.warningBelow }),
        ...(dto.criticalBelow !== undefined && { criticalBelow: dto.criticalBelow }),
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOneOrThrow(id);
    await this.prisma.thresholdIndicator.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async findOneOrThrow(id: string): Promise<ThresholdIndicator> {
    const indicator = await this.prisma.thresholdIndicator.findUnique({ where: { id } });
    if (!indicator) throw new NotFoundException(`ThresholdIndicator ${id} not found`);
    return indicator;
  }
}
