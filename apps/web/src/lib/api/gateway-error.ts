export interface GatewayErrorEnvelope {
  code: string;
  message: string;
  correlationId: string;
  details?: unknown;
}

export const ANNOUNCEMENT_ERROR_MESSAGES: Record<string, string> = {
  UnsupportedAudienceInThisRelease: 'This audience type is not supported yet.',
  ExpiryInPast: 'The expiry date must be in the future.',
  TargetDepartmentRequired: 'A department must be specified for DEPARTMENT audience.',
  UnknownTargetDepartment: 'The selected department does not exist.',
  MissingTeamForTeamAudience: 'A team must be specified for TEAM audience.',
  UnknownTargetTeam: 'The selected team does not exist.',
  InconsistentAudienceTarget: 'Audience and targeting fields are inconsistent.',
  PinExpiryInPast: 'The pin expiry date must be in the future.',
  NotAnnouncementAuthor: 'You can only edit or delete your own announcements.',
};

export const DOCUMENT_ERROR_MESSAGES: Record<string, string> = {
  MissingFile: 'No file was attached to the upload.',
  EmptyFile: 'The uploaded file is empty.',
  FileTooLarge: 'The file exceeds the 25 MiB size limit.',
  PayloadTooLarge: 'The file exceeds the configured gateway upload limit.',
  UnsupportedMimeType: 'File type is not supported. Use PDF, DOCX, TXT, MD, or HTML.',
  StorageUnavailable: 'Storage is temporarily unavailable. Please try again.',
  DocumentNotFound: 'Document not found.',
  DocumentFileMissing: 'The document file is no longer available on the server.',
};

export const OKR_ERROR_MESSAGES: Record<string, string> = {
  CycleNameTaken: 'A cycle with this name already exists.',
  InvalidQuarter: 'Quarter must be 1-4 for quarterly cycles.',
  ParentMustBeAnnual: 'Parent cycle must be an annual cycle.',
  EndBeforeStart: 'End date must be after start date.',
  CycleNotDraft: 'Cycle must be in Draft status to activate.',
  EndDateInPast: 'Cannot activate a cycle whose end date is in the past.',
  CycleNotActive: 'Cannot create an OKR in a closed or draft cycle.',
  ParentNotFound: 'Parent OKR no longer exists.',
  ParentWrongLevel: 'Parent OKR is not at the expected level.',
  ParentNotActive: 'Cannot align to a closed or cancelled parent OKR.',
  CrossDepartmentAlignment: "Employee OKRs must align to your own department's OKRs.",
  LevelMismatch: 'Invalid OKR level configuration.',
  KrNotFound: 'Key Result no longer exists.',
  NotAssigned: 'You are not assigned to this Key Result.',
  KrNotActive: 'This Key Result is not active.',
  BooleanValueInvalid: 'Value must be 0 or 1 for boolean Key Results.',
  CheckInNotPending: 'This check-in was already reviewed.',
  WrongDepartment: 'You can only review check-ins for your own department.',
  ReasonRequired: 'A reason is required to reject a check-in.',
};

export const GATEWAY_ERROR_MESSAGES: Record<string, string> = {
  MissingAuthorization: 'Your session has expired. Please sign in again.',
  MalformedAuthorization: 'Your session is invalid. Please sign in again.',
  JwtExpired: 'Your session has expired. Please sign in again.',
  JwtInvalid: 'Your session is invalid. Please sign in again.',
  RateLimitExceeded: 'Too many requests. Please retry later.',
  PayloadTooLarge: 'The request is too large.',
  NoUpstreamRoute: 'This API route is not available.',
  UpstreamUnavailable: 'The service is temporarily unavailable. Please try again.',
  UpstreamTimeout: 'The service took too long to respond. Please try again.',
  GatewayInternalError: 'The gateway failed to process the request.',
  ...ANNOUNCEMENT_ERROR_MESSAGES,
  ...DOCUMENT_ERROR_MESSAGES,
  ...OKR_ERROR_MESSAGES,
};

export function isGatewayErrorEnvelope(value: unknown): value is GatewayErrorEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.code === 'string' &&
    typeof record.message === 'string' &&
    typeof record.correlationId === 'string'
  );
}

export function extractGatewayErrorCode(error: unknown): string {
  const data = extractResponseData(error);
  if (isGatewayErrorEnvelope(data)) return data.code;

  if (typeof data === 'object' && data !== null) {
    const code = (data as Record<string, unknown>).code;
    if (typeof code === 'string') return code;
  }

  return '';
}

export function extractGatewayErrorMessage(error: unknown): string {
  const data = extractResponseData(error);
  if (isGatewayErrorEnvelope(data)) return data.message;

  if (typeof data === 'object' && data !== null) {
    const message = (data as Record<string, unknown>).message;
    if (typeof message === 'string') return message;
  }

  return '';
}

export function getGatewayErrorMessage(error: unknown, fallback: string): string {
  const code = extractGatewayErrorCode(error);
  if (code && GATEWAY_ERROR_MESSAGES[code]) return GATEWAY_ERROR_MESSAGES[code];

  const message = extractGatewayErrorMessage(error);
  if (message) return message;

  if (isRequestWithoutResponse(error)) {
    return 'Unable to reach the API Gateway. Check the gateway URL and dev proxy.';
  }

  return fallback;
}

export function extractApiError(error: unknown): string {
  return extractGatewayErrorCode(error);
}

function extractResponseData(error: unknown): unknown {
  if (typeof error !== 'object' || error === null || !('response' in error)) return undefined;
  const response = (error as { response?: { data?: unknown } }).response;
  return response?.data;
}

function isRequestWithoutResponse(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('request' in error)) return false;
  return (error as { response?: unknown }).response === undefined;
}
