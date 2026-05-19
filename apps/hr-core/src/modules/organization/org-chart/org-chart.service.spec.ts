import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../../prisma/prisma.service";
import { OrgChartService } from "./org-chart.service";

describe("OrgChartService", () => {
  let service: OrgChartService;
  const prismaMock = {
    employee: {
      findFirst: jest.fn(),
    },
    department: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrgChartService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<OrgChartService>(OrgChartService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("getOrgChart should return root and active hierarchy", async () => {
    prismaMock.employee.findFirst.mockResolvedValue({
      id: "ceo-1",
      firstName: "Amira",
      lastName: "Benyahia",
      email: "amira.benyahia@sentient.dev",
      hireDate: new Date("2018-01-08T00:00:00.000Z"),
      employmentStatus: "ACTIVE",
      departmentId: null,
      teamId: null,
      managerId: null,
      position: { id: "pos-ceo", title: "Chief Executive Officer" },
      skills: [],
    });
    prismaMock.department.findMany.mockResolvedValue([
      {
        id: "dept-1",
        name: "Engineering",
        code: "ENG",
        businessUnitId: "bu-1",
        headId: "emp-1",
        employees: [
          {
            id: "emp-1",
            firstName: "Nadia",
            lastName: "Mansouri",
            email: "nadia.mansouri@sentient.dev",
            hireDate: new Date("2020-01-08T00:00:00.000Z"),
            employmentStatus: "ACTIVE",
            departmentId: "dept-1",
            teamId: "team-1",
            managerId: null,
            position: { id: "pos-1", title: "Engineering Manager" },
            skills: [{ proficiency: "EXPERT", skill: { name: "Leadership" } }],
          },
        ],
        teams: [
          {
            id: "team-1",
            name: "Backend",
            code: "ENG-BE",
            departmentId: "dept-1",
            businessUnitId: "bu-1",
            leadId: "emp-1",
            projectFocus: "Platform APIs",
            employees: [
              {
                id: "emp-1",
                firstName: "Nadia",
                lastName: "Mansouri",
                email: "nadia.mansouri@sentient.dev",
                hireDate: new Date("2020-01-08T00:00:00.000Z"),
                employmentStatus: "ACTIVE",
                departmentId: "dept-1",
                teamId: "team-1",
                managerId: null,
                position: { id: "pos-1", title: "Engineering Manager" },
                skills: [{ proficiency: "EXPERT", skill: { name: "Leadership" } }],
              },
            ],
          },
        ],
      },
    ]);

    const result = await service.getOrgChart();

    expect(result.root?.position?.title).toBe("Chief Executive Officer");
    expect(result.departments).toHaveLength(1);
    expect(result.departments[0]?.head?.id).toBe("emp-1");
    expect(result.departments[0]?.teams[0]?.members[0]?.skills[0]?.skill).toBe("Leadership");
  });
});
