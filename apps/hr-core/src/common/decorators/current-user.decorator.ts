import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { JwtPayload } from "@sentient/shared";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload | undefined => {
    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    // Returns undefined when no JWT guard is active (dev mode — caller falls back to DEV_USER)
    return request.user;
  },
);
