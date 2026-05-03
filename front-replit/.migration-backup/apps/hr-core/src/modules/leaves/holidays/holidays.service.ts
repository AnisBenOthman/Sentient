import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Holiday, Prisma } from '../../../generated/prisma';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateHolidayDto } from '../dto/create-holiday.dto';
import { UpdateHolidayDto } from '../dto/update-holiday.dto';

export interface HolidayQueryDto {
  businessUnitId?: string;
  year?: number;
}

@Injectable()
export class HolidaysService {
  constructor(private readonly prisma: PrismaService) {}

  async listForBusinessUnit(businessUnitId: string, year: number): Promise<Set<string>> {
    const holidays = await this.prisma.holiday.findMany({
      where: {
        businessUnitId,
        OR: [{ year }, { isRecurring: true }],
      },
      select: { date: true },
    });

    return new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));
  }

  async findAll(query: HolidayQueryDto): Promise<Holiday[]> {
    return this.prisma.holiday.findMany({
      where: {
        ...(query.businessUnitId ? { businessUnitId: query.businessUnitId } : {}),
        ...(query.year !== undefined ? { OR: [{ year: query.year }, { isRecurring: true }] } : {}),
      },
      orderBy: { date: 'asc' },
    });
  }

  async create(dto: CreateHolidayDto): Promise<Holiday> {
    const date = new Date(dto.date + 'T00:00:00.000Z');
    const year = dto.isRecurring ? null : (dto.year ?? date.getUTCFullYear());

    try {
      return await this.prisma.holiday.create({
        data: {
          businessUnitId: dto.businessUnitId,
          name: dto.name,
          date,
          isRecurring: dto.isRecurring,
          year,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('DuplicateHoliday');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateHolidayDto): Promise<Holiday> {
    await this.findOne(id);

    const data: Prisma.HolidayUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.isRecurring !== undefined) data.isRecurring = dto.isRecurring;
    if (dto.date !== undefined) data.date = new Date(dto.date + 'T00:00:00.000Z');
    if (dto.year !== undefined) data.year = dto.year;

    try {
      return await this.prisma.holiday.update({ where: { id }, data });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('DuplicateHoliday');
      }
      throw e;
    }
  }

  async delete(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.holiday.delete({ where: { id } });
  }

  private async findOne(id: string): Promise<Holiday> {
    const holiday = await this.prisma.holiday.findUnique({ where: { id } });
    if (!holiday) throw new NotFoundException(`Holiday ${id} not found`);
    return holiday;
  }
}
