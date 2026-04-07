export interface OrgChartTeam {
  id: string;
  name: string;
  code: string | null;
  leadId: string | null;
  leadVacant: boolean;
  projectFocus: string | null;
  employeeCount: number;
}

export interface OrgChartDepartment {
  id: string;
  name: string;
  code: string;
  headId: string | null;
  teams: OrgChartTeam[];
}
