-- CreateEnum
CREATE TYPE "hr_core"."UserStatus" AS ENUM ('PENDING_ACTIVATION', 'ACTIVE', 'LOCKED', 'DISABLED');

-- CreateEnum
CREATE TYPE "hr_core"."SecurityEventType" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'TOKEN_REFRESHED', 'PASSWORD_CHANGED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED', 'USER_CREATED', 'USER_DISABLED', 'ROLE_ASSIGNED', 'ROLE_REVOKED', 'ROLE_CREATED', 'ROLE_DELETED', 'ROLE_PERMISSION_ADDED', 'ROLE_PERMISSION_REMOVED');

-- CreateEnum
CREATE TYPE "hr_core"."PermissionAction" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE');

-- CreateEnum
CREATE TYPE "hr_core"."PermissionScope" AS ENUM ('OWN', 'TEAM', 'DEPARTMENT', 'BUSINESS_UNIT', 'GLOBAL');

-- CreateEnum
CREATE TYPE "hr_core"."ChannelType" AS ENUM ('WEB', 'SLACK', 'WHATSAPP', 'EMAIL', 'IN_APP');

-- CreateTable
CREATE TABLE "hr_core"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "passwordHistory" JSONB NOT NULL DEFAULT '[]',
    "status" "hr_core"."UserStatus" NOT NULL DEFAULT 'PENDING_ACTIVATION',
    "employeeId" TEXT,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_core"."roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isEditable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_core"."permissions" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" "hr_core"."PermissionAction" NOT NULL,
    "scope" "hr_core"."PermissionScope" NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_core"."user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "scope" "hr_core"."PermissionScope" NOT NULL,
    "scopeEntityId" TEXT,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_core"."role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_core"."sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "hr_core"."ChannelType" NOT NULL,
    "accessTokenHash" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "previousTokenHash" TEXT,
    "previousRotatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_core"."password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_core"."security_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" "hr_core"."SecurityEventType" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "hr_core"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeId_key" ON "hr_core"."users"("employeeId");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "hr_core"."users"("status");

-- CreateIndex
CREATE INDEX "users_employeeId_idx" ON "hr_core"."users"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "hr_core"."roles"("code");

-- CreateIndex
CREATE INDEX "roles_isSystem_idx" ON "hr_core"."roles"("isSystem");

-- CreateIndex
CREATE INDEX "roles_isEditable_idx" ON "hr_core"."roles"("isEditable");

-- CreateIndex
CREATE INDEX "permissions_resource_idx" ON "hr_core"."permissions"("resource");

-- CreateIndex
CREATE INDEX "permissions_action_idx" ON "hr_core"."permissions"("action");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_resource_action_scope_key" ON "hr_core"."permissions"("resource", "action", "scope");

-- CreateIndex
CREATE INDEX "user_roles_userId_idx" ON "hr_core"."user_roles"("userId");

-- CreateIndex
CREATE INDEX "user_roles_roleId_idx" ON "hr_core"."user_roles"("roleId");

-- CreateIndex
CREATE INDEX "user_roles_revokedAt_idx" ON "hr_core"."user_roles"("revokedAt");

-- CreateIndex
CREATE INDEX "user_roles_userId_roleId_idx" ON "hr_core"."user_roles"("userId", "roleId");

-- CreateIndex
CREATE INDEX "role_permissions_roleId_idx" ON "hr_core"."role_permissions"("roleId");

-- CreateIndex
CREATE INDEX "role_permissions_permissionId_idx" ON "hr_core"."role_permissions"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "hr_core"."role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "hr_core"."sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_revokedAt_idx" ON "hr_core"."sessions"("revokedAt");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "hr_core"."sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "hr_core"."password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "hr_core"."password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "hr_core"."password_reset_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "security_events_userId_eventType_idx" ON "hr_core"."security_events"("userId", "eventType");

-- CreateIndex
CREATE INDEX "security_events_createdAt_idx" ON "hr_core"."security_events"("createdAt");

-- CreateIndex
CREATE INDEX "security_events_eventType_idx" ON "hr_core"."security_events"("eventType");

-- AddForeignKey
ALTER TABLE "hr_core"."users" ADD CONSTRAINT "users_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr_core"."employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_core"."user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "hr_core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_core"."user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "hr_core"."roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_core"."role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "hr_core"."roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_core"."role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "hr_core"."permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_core"."sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "hr_core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_core"."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "hr_core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_core"."security_events" ADD CONSTRAINT "security_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "hr_core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Partial unique index: one active role assignment per (user, role, scope entity).
-- COALESCE maps NULL → '' so GLOBAL/OWN rows without a scopeEntityId collide correctly.
CREATE UNIQUE INDEX "user_roles_active_assignment_uidx"
  ON "hr_core"."user_roles" ("userId", "roleId", COALESCE("scopeEntityId", ''))
  WHERE "revokedAt" IS NULL;

-- Partial unique index: one active session per (user, channel).
CREATE UNIQUE INDEX "sessions_active_channel_uidx"
  ON "hr_core"."sessions" ("userId", "channel")
  WHERE "revokedAt" IS NULL;
