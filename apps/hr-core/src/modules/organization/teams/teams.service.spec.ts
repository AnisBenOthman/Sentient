import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { ChannelType, EmploymentStatus, JwtPayload, PermissionScope } from "@sentient/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { TeamQueryDto } from "./dto/team-query.dto";
import { TeamsService } from "./teams.service";

const team = {
  id: "team-1",
  name: "Platform",
  code: "PLT",
  description: null,
  departmentId: "dept-1",
  businessUnitId: "bu-1",
  leadId: "emp-lead",
  projectFocus: null,
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

function user(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    sub: "user-1",
    employeeId: "emp-1",
    roles: ["EMPLOYEE"],
    departmentId: "dept-1",
    teamId: "team-1",
    businessUnitId: "bu-1",
    channel: ChannelType.WEB,
    roleAssignments: [],
    sessionId: "session-1",
    iat: 0,
    exp: 0,
    ...overrides,
  };
}

function query(overrides: Partial<TeamQueryDto> = {}): TeamQueryDto {
  return Object.assign(new TeamQueryDto(), overrides);
}

describe("TeamsService", () => {
  const prisma = {
    team: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    department: { findFirst: jest.fn() },
    employee: { findUnique: jest.fn() },
  };

  let service: TeamsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TeamsService(prisma as unknown as PrismaService);
  });

  describe("create", () => {
    it("persists a team under the department's business unit", async () => {
      prisma.department.findFirst.mockResolvedValue({ id: "dept-1", businessUnitId: "bu-1" });
      prisma.employee.findUnique.mockResolvedValue({ id: "emp-lead" });
      prisma.team.findFirst.mockResolvedValue(null);
      prisma.team.create.mockResolvedValue(team);

      const result = await service.create({
        name: "Platform",
        code: "PLT",
        departmentId: "dept-1",
        leadId: "emp-lead",
      });

      expect(result).toEqual(team);
      expect(prisma.team.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Platform",
          departmentId: "dept-1",
          businessUnitId: "bu-1",
          leadId: "emp-lead",
        }),
      });
    });

    it("rejects an inactive or missing department", async () => {
      prisma.department.findFirst.mockResolvedValue(null);

      await expect(service.create({ name: "Platform", departmentId: "dept-x" })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.team.create).not.toHaveBeenCalled();
    });

    it("rejects a lead that is not an existing employee", async () => {
      prisma.department.findFirst.mockResolvedValue({ id: "dept-1", businessUnitId: "bu-1" });
      prisma.employee.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ name: "Platform", departmentId: "dept-1", leadId: "ghost" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("rejects a code already used in the same business unit", async () => {
      prisma.department.findFirst.mockResolvedValue({ id: "dept-1", businessUnitId: "bu-1" });
      prisma.team.findFirst.mockResolvedValue({ ...team, id: "team-other" });

      await expect(
        service.create({ name: "Platform", code: "PLT", departmentId: "dept-1" }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("findAll", () => {
    beforeEach(() => {
      prisma.team.findMany.mockResolvedValue([team]);
      prisma.team.count.mockResolvedValue(1);
    });

    it("restricts a team-scoped manager to the team they lead", async () => {
      const result = await service.findAll(
        query({ departmentId: "dept-other" }),
        user({
          roles: ["MANAGER"],
          roleAssignments: [{ roleCode: "MANAGER", scope: PermissionScope.TEAM, scopeEntityId: "team-9" }],
        }),
      );

      expect(prisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "team-9", isActive: true } }),
      );
      expect(result).toEqual({ data: [team], nextCursor: null, total: 1 });
    });

    it("widens a department-scoped manager to every team in their department", async () => {
      await service.findAll(
        query(),
        user({
          roles: ["MANAGER"],
          roleAssignments: [
            { roleCode: "MANAGER", scope: PermissionScope.DEPARTMENT, scopeEntityId: "dept-7" },
          ],
        }),
      );

      expect(prisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { departmentId: "dept-7", isActive: true } }),
      );
    });

    it("returns an empty page for a manager with no team assignment", async () => {
      const result = await service.findAll(query(), user({ roles: ["MANAGER"], teamId: null }));

      expect(result).toEqual({ data: [], nextCursor: null, total: 0 });
      expect(prisma.team.findMany).not.toHaveBeenCalled();
    });

    it("never lets a non-admin list inactive teams", async () => {
      await service.findAll(query({ isActive: false }), user());

      expect(prisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it("lets an HR admin filter by department and include inactive teams", async () => {
      await service.findAll(query({ isActive: false, departmentId: "dept-2" }), user({ roles: ["HR_ADMIN"] }));

      expect(prisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: false, departmentId: "dept-2" } }),
      );
    });

    it("returns a cursor when the page is full", async () => {
      const result = await service.findAll(query({ limit: 1 }), user({ roles: ["HR_ADMIN"] }));

      expect(result.nextCursor).toBe("team-1");
    });
  });

  describe("findById", () => {
    it("forbids a manager from reading a team they do not lead", async () => {
      await expect(
        service.findById("team-2", user({ roles: ["MANAGER"], teamId: "team-1" })),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.team.findUnique).not.toHaveBeenCalled();
    });

    it("throws NotFoundException for an unknown team", async () => {
      prisma.team.findUnique.mockResolvedValue(null);

      await expect(service.findById("team-x", user({ roles: ["HR_ADMIN"] }))).rejects.toThrow(
        NotFoundException,
      );
    });

    it("reports the lead as vacant when the lead was terminated", async () => {
      prisma.team.findUnique.mockResolvedValue(team);
      prisma.employee.findUnique.mockResolvedValue({ employmentStatus: EmploymentStatus.TERMINATED });

      const result = await service.findById("team-1", user({ roles: ["HR_ADMIN"] }));

      expect(result.leadVacant).toBe(true);
    });

    it("reports the lead as filled when the lead is active", async () => {
      prisma.team.findUnique.mockResolvedValue(team);
      prisma.employee.findUnique.mockResolvedValue({ employmentStatus: EmploymentStatus.ACTIVE });

      const result = await service.findById("team-1", user());

      expect(result.leadVacant).toBe(false);
    });

    it("does not flag a team without a lead as vacant", async () => {
      prisma.team.findUnique.mockResolvedValue({ ...team, leadId: null });

      const result = await service.findById("team-1", user());

      expect(result.leadVacant).toBe(false);
      expect(prisma.employee.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("modifies a team and moves it to the new department's business unit", async () => {
      prisma.team.findUnique.mockResolvedValue(team);
      prisma.department.findFirst.mockResolvedValue({ id: "dept-2", businessUnitId: "bu-2" });
      prisma.team.update.mockResolvedValue({ ...team, name: "Core", departmentId: "dept-2" });

      await service.update("team-1", { name: "Core", departmentId: "dept-2" });

      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: "team-1" },
        data: { name: "Core", departmentId: "dept-2", businessUnitId: "bu-2" },
      });
    });

    it("throws NotFoundException for an unknown team", async () => {
      prisma.team.findUnique.mockResolvedValue(null);

      await expect(service.update("team-x", { name: "Core" })).rejects.toThrow(NotFoundException);
    });

    it("rejects a move to an inactive department", async () => {
      prisma.team.findUnique.mockResolvedValue(team);
      prisma.department.findFirst.mockResolvedValue(null);

      await expect(service.update("team-1", { departmentId: "dept-dead" })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.team.update).not.toHaveBeenCalled();
    });
  });

  describe("deactivate", () => {
    it("soft-deletes a team", async () => {
      prisma.team.findUnique.mockResolvedValue(team);
      prisma.team.update.mockResolvedValue({ id: "team-1", isActive: false, updatedAt: team.updatedAt });

      const result = await service.deactivate("team-1");

      expect(result.isActive).toBe(false);
      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: "team-1" },
        data: { isActive: false },
        select: { id: true, isActive: true, updatedAt: true },
      });
    });

    it("throws NotFoundException for an unknown team", async () => {
      prisma.team.findUnique.mockResolvedValue(null);

      await expect(service.deactivate("team-x")).rejects.toThrow(NotFoundException);
    });
  });
});
