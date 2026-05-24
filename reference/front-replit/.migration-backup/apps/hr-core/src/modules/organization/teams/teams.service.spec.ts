import { Test, TestingModule } from "@nestjs/testing";
import { TeamsService } from "./teams.service";

describe("TeamsService", () => {
  let service: TeamsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TeamsService],
    }).compile();

    service = module.get<TeamsService>(TeamsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("create should persist a team");
  it("findAll should enforce manager scope");
  it("findById should compute leadVacant");
  it("update should modify a team");
  it("deactivate should soft-delete a team");
});
