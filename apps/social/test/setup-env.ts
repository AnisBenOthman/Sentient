/**
 * WHY: several suites boot the full AppModule, whose providers read required
 * config at construction (HrCoreClient → HR_CORE_URL) or per request
 * (SharedJwtGuard → JWT_SECRET). Without this they only passed on a machine
 * that happened to have apps/social/.env, and failed in CI or a fresh clone.
 *
 * Values are pinned rather than defaulted: process.env wins over .env in
 * @nestjs/config, and the suites sign tokens with exactly these secrets, so a
 * developer's real .env must not change the outcome. No network or database is
 * touched — PrismaService is overridden and the HR Core URL is never called.
 */
process.env['HR_CORE_URL'] = 'http://hr-core.test.invalid';
process.env['SOCIAL_DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test?schema=social';
process.env['JWT_SECRET'] = 'change-me-in-production-minimum-32-random-characters';
process.env['SYSTEM_JWT_SECRET'] = 'change-me-system-secret-minimum-32-random-characters';
