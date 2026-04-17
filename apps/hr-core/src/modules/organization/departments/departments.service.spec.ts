import { Test, TestingModule } from "@nestjs/testing";
import { DepartmentsService } from "./departments.service";

describe("DepartmentsService", () => {
  let service: DepartmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DepartmentsService],
    }).compile();

    service = module.get<DepartmentsService>(DepartmentsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("create should persist a department");
  it("findAll should return paginated departments");
  it("findById should return a department with teams");
  it("update should modify a department");
  it("deactivate should soft-delete a department");
});
