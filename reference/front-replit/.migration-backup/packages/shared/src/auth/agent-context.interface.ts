import { JwtPayload } from './jwt-payload.interface';
import { SystemJwtPayload } from './system-jwt-payload.interface';

export interface AgentContext {
  /** JWT forwarded unchanged from the original HTTP request. */
  jwt: string;
  /** Decoded once at conversation start — do not re-verify per tool call. */
  claims: JwtPayload | SystemJwtPayload;
  /**
   * WHY: Distinguishes SYSTEM/SCHEDULE tasks (exit survey dispatch,
   * engagement snapshots) from user-initiated conversations. Controls
   * which JWT is forwarded to target services.
   */
  isSystemContext: boolean;
  /** Parent AgentTaskLog ID — all child tool calls nest under this. */
  taskLogId: string;
}
