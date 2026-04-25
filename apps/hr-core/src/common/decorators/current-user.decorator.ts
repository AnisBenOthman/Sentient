import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { JwtPayload } from "@sentient/shared";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload | undefined => {
    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    // Returns undefined only for @Public() endpoints (no JWT guard active)
    return request.user;
  },
);
