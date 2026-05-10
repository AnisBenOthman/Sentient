export interface OrgChartTeam {
  id: string;
  name: string;
  code: string | null;
  departmentId: string;
  businessUnitId: string;
  leadId: string | null;
  lead: OrgChartEmployee | null;
  leadVacant: boolean;
  projectFocus: string | null;
  employeeCount: number;
}

export interface OrgChartEmployee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position: { id: string; title: string } | null;
}

export interface OrgChartDepartment {
  id: string;
  name: string;
  code: string;
  businessUnitId: string;
  headId: string | null;
  head: OrgChartEmployee | null;
  teams: OrgChartTeam[];
}
