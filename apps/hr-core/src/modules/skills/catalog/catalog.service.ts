import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Skill } from '../../../generated/prisma';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateSkillDto } from '../dto/create-skill.dto';
import { SkillQueryDto } from '../dto/skill-query.dto';
import { UpdateSkillDto } from '../dto/update-skill.dto';

export interface PaginatedSkills {
  data: Skill[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSkillDto): Promise<Skill> {
    const name = dto.name.trim();
    await this.assertNameAvailable(name, null);
    return this.prisma.skill.create({
      data: { name, category: dto.category, description: dto.description },
    });
  }

  async findAll(query: SkillQueryDto): Promise<PaginatedSkills> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where = {
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
      ...(query.category !== undefined ? { category: query.category } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.skill.findMany({
        where,
        orderBy: { [query.sortBy ?? 'name']: query.sortOrder ?? 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.skill.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string): Promise<Skill> {
    const skill = await this.prisma.skill.findUnique({ where: { id } });
    if (!skill) throw new NotFoundException(`Skill ${id} not found`);
    return skill;
  }

  async update(id: string, dto: UpdateSkillDto): Promise<Skill> {
    await this.findById(id);
    if (dto.name) {
      const name = dto.name.trim();
      await this.assertNameAvailable(name, id);
      dto = { ...dto, name };
    }
    return this.prisma.skill.update({ where: { id }, data: dto });
  }

  private async assertNameAvailable(name: string, excludeId: string | null): Promise<void> {
    const existing = await this.prisma.skill.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Skill name already exists');
  }
}
