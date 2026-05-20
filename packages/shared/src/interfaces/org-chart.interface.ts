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
  members: OrgChartEmployee[];
}

export interface OrgChartEmployeeSkill {
  skill: string;
  proficiency: string;
}

export interface OrgChartEmployee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  hireDate: string | Date;
  employmentStatus: string;
  departmentId: string | null;
  teamId: string | null;
  managerId: string | null;
  position: { id: string; title: string } | null;
  skills: OrgChartEmployeeSkill[];
}

export interface OrgChartDepartment {
  id: string;
  name: string;
  code: string;
  businessUnitId: string;
  businessUnit: { id: string; name: string } | null;
  headId: string | null;
  head: OrgChartEmployee | null;
  teams: OrgChartTeam[];
}

export interface OrgChartResponse {
  root: OrgChartEmployee | null;
  departments: OrgChartDepartment[];
}
