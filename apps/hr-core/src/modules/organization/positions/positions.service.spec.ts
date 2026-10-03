import { ConflictException, NotFoundException } from "@nestjs/common";
import { PositionLevel } from "@sentient/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { PositionQueryDto } from "./dto/position-query.dto";
import { PositionsService } from "./positions.service";

const position = {
  id: "pos-1",
  title: "Backend Engineer",
  level: PositionLevel.SENIOR_1,
  isKeyPosition: false,
  keyPositionRisk: null,
  hasSuccessor: false,
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

function query(overrides: Partial<PositionQueryDto> = {}): PositionQueryDto {
  return Object.assign(new PositionQueryDto(), overrides);
}

describe("PositionsService", () => {
  const prisma = {
    position: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: PositionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PositionsService(prisma as unknown as PrismaService);
  });

  describe("create", () => {
    it("persists a position with key-position defaults", async () => {
      prisma.position.findUnique.mockResolvedValue(null);
      prisma.position.create.mockResolvedValue(position);

      const result = await service.create({ title: "Backend Engineer", level: PositionLevel.SENIOR_1 });

      expect(result).toEqual(position);
      expect(prisma.position.create).toHaveBeenCalledWith({
        data: {
          title: "Backend Engineer",
          level: PositionLevel.SENIOR_1,
          isKeyPosition: false,
          keyPositionRisk: undefined,
          hasSuccessor: false,
        },
      });
    });

    it("rejects a duplicate title", async () => {
      prisma.position.findUnique.mockResolvedValue(position);

      await expect(service.create({ title: "Backend Engineer" })).rejects.toThrow(ConflictException);
      expect(prisma.position.create).not.toHaveBeenCalled();
    });
  });

  describe("findAll", () => {
    beforeEach(() => {
      prisma.position.findMany.mockResolvedValue([position]);
      prisma.position.count.mockResolvedValue(1);
    });

    it("never lets a non-admin list inactive positions", async () => {
      await service.findAll(query({ isActive: false }), ["EMPLOYEE"]);

      expect(prisma.position.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it("lets an HR admin list inactive positions", async () => {
      await service.findAll(query({ isActive: false }), ["HR_ADMIN"]);

      expect(prisma.position.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: false } }),
      );
    });

    it("filters by key position when asked", async () => {
      await service.findAll(query({ isKeyPosition: true }), ["EMPLOYEE"]);

      expect(prisma.position.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true, isKeyPosition: true } }),
      );
    });

    it("returns a cursor only when the page is full", async () => {
      const full = await service.findAll(query({ limit: 1 }), ["HR_ADMIN"]);
      const partial = await service.findAll(query(), ["HR_ADMIN"]);

      expect(full.nextCursor).toBe("pos-1");
      expect(partial).toEqual({ data: [position], nextCursor: null, total: 1 });
    });
  });

  describe("findById", () => {
    it("returns one position", async () => {
      prisma.position.findUnique.mockResolvedValue(position);

      await expect(service.findById("pos-1")).resolves.toEqual(position);
    });

    it("throws NotFoundException for an unknown position", async () => {
      prisma.position.findUnique.mockResolvedValue(null);

      await expect(service.findById("pos-x")).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("modifies a position", async () => {
      prisma.position.findUnique
        .mockResolvedValueOnce(position) // existence check
        .mockResolvedValueOnce(null); // title uniqueness check
      prisma.position.update.mockResolvedValue({ ...position, title: "Staff Engineer" });

      const result = await service.update("pos-1", { title: "Staff Engineer" });

      expect(result.title).toBe("Staff Engineer");
      expect(prisma.position.update).toHaveBeenCalledWith({
        where: { id: "pos-1" },
        data: { title: "Staff Engineer" },
      });
    });

    it("allows keeping its own title", async () => {
      prisma.position.findUnique.mockResolvedValue(position);
      prisma.position.update.mockResolvedValue(position);

      await expect(service.update("pos-1", { title: "Backend Engineer" })).resolves.toEqual(position);
    });

    it("rejects a title used by another position", async () => {
      prisma.position.findUnique
        .mockResolvedValueOnce(position)
        .mockResolvedValueOnce({ ...position, id: "pos-2", title: "Staff Engineer" });

      await expect(service.update("pos-1", { title: "Staff Engineer" })).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.position.update).not.toHaveBeenCalled();
    });
  });

  describe("deactivate", () => {
    it("soft-deletes a position", async () => {
      prisma.position.findUnique.mockResolvedValue(position);
      prisma.position.update.mockResolvedValue({ id: "pos-1", isActive: false });

      await expect(service.deactivate("pos-1")).resolves.toEqual({ id: "pos-1", isActive: false });
      expect(prisma.position.update).toHaveBeenCalledWith({
        where: { id: "pos-1" },
        data: { isActive: false },
        select: { id: true, isActive: true },
      });
    });

    it("throws NotFoundException for an unknown position", async () => {
      prisma.position.findUnique.mockResolvedValue(null);

      await expect(service.deactivate("pos-x")).rejects.toThrow(NotFoundException);
    });
  });
});
