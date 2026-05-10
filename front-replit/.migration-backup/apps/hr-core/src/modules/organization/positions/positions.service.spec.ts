import { Test, TestingModule } from "@nestjs/testing";
import { PositionsService } from "./positions.service";

describe("PositionsService", () => {
  let service: PositionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PositionsService],
    }).compile();

    service = module.get<PositionsService>(PositionsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("create should persist a position");
  it("findAll should enforce active filter");
  it("findById should return one position");
  it("update should modify a position");
  it("deactivate should soft-delete a position");
});
