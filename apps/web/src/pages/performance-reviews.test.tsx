export interface PerformanceReviewSmokeCase {
  name: string;
  expectedView: 'mine' | 'assigned' | 'cycles' | 'outcomes';
  roles: string[];
}

export const performanceReviewSmokeCases: PerformanceReviewSmokeCase[] = [
  { name: 'employee can see my reviews', expectedView: 'mine', roles: ['EMPLOYEE'] },
  { name: 'manager can see assigned reviews', expectedView: 'assigned', roles: ['MANAGER'] },
  { name: 'hr admin can manage cycles', expectedView: 'cycles', roles: ['HR_ADMIN'] },
  { name: 'hr admin can track outcomes', expectedView: 'outcomes', roles: ['HR_ADMIN'] },
];

export function assertPerformanceReviewSmokeCoverage(
  cases: PerformanceReviewSmokeCase[] = performanceReviewSmokeCases,
): boolean {
  const views = new Set(cases.map((item) => item.expectedView));
  return ['mine', 'assigned', 'cycles', 'outcomes'].every((view) => views.has(view as PerformanceReviewSmokeCase['expectedView']));
}
