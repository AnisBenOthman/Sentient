declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void | Promise<void>): void;
declare function beforeEach(fn: () => void | Promise<void>): void;

interface JestExpectation {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toContain(expected: unknown): void;
  toBeDefined(): void;
  toHaveLength(expected: number): void;
  not: {
    toContain(expected: unknown): void;
  };
}

declare function expect(actual: unknown): JestExpectation;
