export interface JwtClaims {
  sub: string;
  email?: string;
  role?: string;
  roles?: string[];
  iat?: number;
  exp?: number;
  [claim: string]: unknown;
}

