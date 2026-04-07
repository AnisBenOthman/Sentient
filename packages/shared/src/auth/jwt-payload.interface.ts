import { ChannelType } from '../enums/channel-type.enum';

export interface JwtPayload {
  sub: string;
  employeeId: string;
  roles: string[];
  departmentId: string;
  teamId: string | null;
  channel: ChannelType;
  iat: number;
  exp: number;
}
