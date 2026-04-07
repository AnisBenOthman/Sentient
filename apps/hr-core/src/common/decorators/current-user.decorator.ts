import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtPayload } from "@sentient/shared";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload => {
    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();

    if (!request.user) {
      throw new UnauthorizedException("Authenticated user was not attached");
    }

    return request.user;
  },
);
