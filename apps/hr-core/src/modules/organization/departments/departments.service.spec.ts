import { ConflictException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { DepartmentsService } from "./departments.service";
import { DepartmentQueryDto } from "./dto/department-query.dto";

const department = {
  id: "dept-1",
  name: "Engineering",
  code: "ENG",
  description: null,
  headId: "emp-head",
  businessUnitId: "bu-1",
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

function query(overrides: Partial<DepartmentQueryDto> = {}): DepartmentQueryDto {
  return Object.assign(new DepartmentQueryDto(), overrides);
}

describe("DepartmentsService", () => {
  const prisma = {
    department: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    employee: { findUnique: jest.fn() },
    businessUnit: { findUnique: jest.fn() },
  };

  let service: DepartmentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DepartmentsService(prisma as unknown as PrismaService);
  });

  describe("create", () => {
    it("persists a department after validating head and business unit", async () => {
      prisma.department.findFirst.mockResolvedValue(null);
      prisma.employee.findUnique.mockResolvedValue({ id: "emp-head" });
      prisma.businessUnit.findUnique.mockResolvedValue({ id: "bu-1", isActive: true });
      prisma.department.create.mockResolvedValue(department);

      const result = await service.create({
        name: "Engineering",
        code: "ENG",
        headId: "emp-head",
        businessUnitId: "bu-1",
      });

      expect(result).toEqual(department);
      expect(prisma.department.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: "Engineering", code: "ENG", businessUnitId: "bu-1" }),
      });
    });

    it("rejects a name already used in the same business unit", async () => {
      prisma.department.findFirst.mockResolvedValueOnce({ ...department, id: "dept-other" });

      await expect(
        service.create({ name: "Engineering", code: "ENG2", businessUnitId: "bu-1" }),
      ).rejects.toThrow("Department name already exists");
    });

    it("rejects a code already used in the same business unit", async () => {
      prisma.department.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...department, id: "dept-other" });

      await expect(
        service.create({ name: "Platform", code: "ENG", businessUnitId: "bu-1" }),
      ).rejects.toThrow("Department code already exists");
    });

    it("rejects a head that is not an existing employee", async () => {
      prisma.department.findFirst.mockResolvedValue(null);
      prisma.employee.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ name: "Engineering", code: "ENG", headId: "ghost", businessUnitId: "bu-1" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("rejects an inactive business unit", async () => {
      prisma.department.findFirst.mockResolvedValue(null);
      prisma.businessUnit.findUnique.mockResolvedValue({ id: "bu-1", isActive: false });

      await expect(
        service.create({ name: "Engineering", code: "ENG", businessUnitId: "bu-1" }),
      ).rejects.toThrow("is inactive");
      expect(prisma.department.create).not.toHaveBeenCalled();
    });
  });

  describe("findAll", () => {
    beforeEach(() => {
      prisma.department.findMany.mockResolvedValue([department]);
      prisma.department.count.mockResolvedValue(1);
    });

    it("returns a paginated page of departments", async () => {
      const result = await service.findAll(query(), ["EMPLOYEE"]);

      expect(result).toEqual({ data: [department], nextCursor: null, total: 1 });
      expect(prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: "asc" }, take: 20 }),
      );
    });

    it("returns a cursor when the page is full and resumes after it", async () => {
      const result = await service.findAll(query({ limit: 1, cursor: "dept-0" }), ["HR_ADMIN"]);

      expect(result.nextCursor).toBe("dept-1");
      expect(prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: { id: "dept-0" }, skip: 1 }),
      );
    });

    it("never lets a non-admin list inactive departments", async () => {
      await service.findAll(query({ isActive: false }), ["EMPLOYEE", "MANAGER"]);

      expect(prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it("lets an HR admin list inactive departments", async () => {
      await service.findAll(query({ isActive: false }), ["GLOBAL_HR_ADMIN"]);

      expect(prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: false } }),
      );
    });
  });

  describe("findById", () => {
    it("returns a department with its teams, business unit and head", async () => {
      const head = { id: "emp-head", firstName: "Sara", lastName: "Smith" };
      prisma.department.findUnique.mockResolvedValue({
        ...department,
        teams: [{ id: "team-1", name: "Platform", isActive: true }],
        businessUnit: { id: "bu-1", name: "HQ", address: "Algiers" },
      });
      prisma.employee.findUnique.mockResolvedValue(head);

      const result = await service.findById("dept-1");

      expect(result.teams).toHaveLength(1);
      expect(result.head).toEqual(head);
    });

    it("returns a null head when the head no longer exists", async () => {
      prisma.department.findUnique.mockResolvedValue({ ...department, teams: [], businessUnit: null });
      prisma.employee.findUnique.mockResolvedValue(null);

      const result = await service.findById("dept-1");

      expect(result.head).toBeNull();
    });

    it("throws NotFoundException for an unknown department", async () => {
      prisma.department.findUnique.mockResolvedValue(null);

      await expect(service.findById("dept-x")).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("modifies a department", async () => {
      prisma.department.findUnique.mockResolvedValue(department);
      prisma.department.findFirst.mockResolvedValue(null);
      prisma.department.update.mockResolvedValue({ ...department, name: "R&D" });

      const result = await service.update("dept-1", { name: "R&D", description: "Research" });

      expect(result.name).toBe("R&D");
      expect(prisma.department.update).toHaveBeenCalledWith({
        where: { id: "dept-1" },
        data: { name: "R&D", description: "Research" },
      });
    });

    it("rechecks name and code uniqueness when moving to another business unit", async () => {
      prisma.department.findUnique.mockResolvedValue(department);
      prisma.department.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...department, id: "dept-clash", businessUnitId: "bu-2" });
      prisma.businessUnit.findUnique.mockResolvedValue({ id: "bu-2", isActive: true });

      await expect(service.update("dept-1", { businessUnitId: "bu-2" })).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.department.findFirst).toHaveBeenLastCalledWith({
        where: { code: "ENG", businessUnitId: "bu-2" },
      });
    });

    it("throws NotFoundException for an unknown department", async () => {
      prisma.department.findUnique.mockResolvedValue(null);

      await expect(service.update("dept-x", { name: "R&D" })).rejects.toThrow(NotFoundException);
    });
  });

  describe("deactivate", () => {
    it("soft-deletes a department", async () => {
      prisma.department.findUnique.mockResolvedValue(department);
      prisma.department.update.mockResolvedValue({
        id: "dept-1",
        isActive: false,
        updatedAt: department.updatedAt,
      });

      const result = await service.deactivate("dept-1");

      expect(result.isActive).toBe(false);
      expect(prisma.department.update).toHaveBeenCalledWith({
        where: { id: "dept-1" },
        data: { isActive: false },
        select: { id: true, isActive: true, updatedAt: true },
      });
    });

    it("throws NotFoundException for an unknown department", async () => {
      prisma.department.findUnique.mockResolvedValue(null);

      await expect(service.deactivate("dept-x")).rejects.toThrow(NotFoundException);
    });
  });
});
