export interface RequestUser {
  id: string;
  email: string;
  branchId: string | null;
  departmentId: string | null;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  branchId: string | null;
  departmentId: string | null;
}

export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
}
