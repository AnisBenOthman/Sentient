/**
 * Roles permitted to use the AI assistant at all. Referenced by the HTTP
 * controller's @Roles() AND by ActorContextFactory.fromChannelToken(), so a
 * chat channel enforces exactly the role gate the HTTP pipeline does.
 */
export const AI_USER_ROLES: readonly string[] = ['HR_ADMIN', 'MANAGER', 'TEAM_LEAD', 'EMPLOYEE', 'EXECUTIVE', 'SYSTEM_ADMIN'];
