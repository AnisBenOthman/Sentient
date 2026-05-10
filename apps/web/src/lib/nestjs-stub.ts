// Stub for @nestjs/* packages pulled in transitively by @sentient/shared guards.
// These guards are server-only; the browser never calls them.
// This file satisfies the import so Vite can bundle without errors.

export const Injectable = () => (_target: unknown) => {};
export const Optional = () => (_target: unknown, _key?: unknown, _idx?: unknown) => {};
export const createParamDecorator = (_factory: unknown) => (_data?: unknown) => (_target: unknown, _key?: unknown, _idx?: unknown) => {};
export class ForbiddenException extends Error { constructor(msg?: string) { super(msg); } }
export class UnauthorizedException extends Error { constructor(msg?: string) { super(msg); } }
export class BadRequestException extends Error { constructor(msg?: string) { super(msg); } }
export class NotFoundException extends Error { constructor(msg?: string) { super(msg); } }
export class InternalServerErrorException extends Error { constructor(msg?: string) { super(msg); } }
export const SetMetadata = (_key: unknown, _value: unknown) => () => {};
export const applyDecorators = (..._fns: unknown[]) => () => {};
export class ExecutionContext {}
export class CanActivate {}
export class Reflector { getAllAndOverride() { return null; } }
export class ConfigService { get() { return null; } getOrThrow() { return ''; } }
export class HttpException extends Error {}
