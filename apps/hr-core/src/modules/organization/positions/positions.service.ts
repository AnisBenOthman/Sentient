import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, Position } from "../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import { CreatePositionDto } from "./dto/create-position.dto";
import { PositionQueryDto } from "./dto/position-query.dto";
import { UpdatePositionDto } from "./dto/update-position.dto";

export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
  total: number;
}

@Injectable()
export class PositionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPositionDto: CreatePositionDto): Promise<Position> {
    await this.ensureUniqueTitle(null, createPositionDto.title);

    return this.prisma.position.create({
      data: {
        title: createPositionDto.title,
        level: createPositionDto.level,
        isKeyPosition: createPositionDto.isKeyPosition ?? false,
        keyPositionRisk: createPositionDto.keyPositionRisk,
        hasSuccessor: createPositionDto.hasSuccessor ?? false,
      },
    });
  }

  async findAll(
    query: PositionQueryDto,
    roles: string[],
  ): Promise<CursorPage<Position>> {
    const isAdmin = roles.includes("HR_ADMIN");

    const where: Prisma.PositionWhereInput = {
      isActive: isAdmin ? (query.isActive ?? true) : true,
      ...(query.isKeyPosition !== undefined
        ? { isKeyPosition: query.isKeyPosition }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.position.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: query.limit,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      this.prisma.position.count({ where }),
    ]);

    const lastItem = data[data.length - 1];
    const nextCursor =
      data.length === query.limit && lastItem ? lastItem.id : null;

    return {
      data,
      nextCursor,
      total,
    };
  }

  async findById(id: string): Promise<Position> {
    const position = await this.prisma.position.findUnique({ where: { id } });

    if (!position) {
      throw new NotFoundException(`Position ${id} not found`);
    }

    return position;
  }

  async update(
    id: string,
    updatePositionDto: UpdatePositionDto,
  ): Promise<Position> {
    await this.findById(id);

    if (updatePositionDto.title) {
      await this.ensureUniqueTitle(id, updatePositionDto.title);
    }

    return this.prisma.position.update({
      where: { id },
      data: updatePositionDto,
    });
  }

  async deactivate(
    id: string,
  ): Promise<Pick<Position, "id" | "isActive">> {
    await this.findById(id);

    return this.prisma.position.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        isActive: true,
      },
    });
  }

  private async ensureUniqueTitle(
    excludeId: string | null,
    title: string,
  ): Promise<void> {
    const existing = await this.prisma.position.findUnique({
      where: { title },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException("Position title already exists");
    }
  }
}
