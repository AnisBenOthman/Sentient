import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditController } from './controllers/audit.controller';
import { AuthController } from './controllers/auth.controller';
import { RolesController } from './controllers/roles.controller';
import { SessionsController } from './controllers/sessions.controller';
import { UsersController } from './controllers/users.controller';
import { UserStatusGuard } from './guards/user-status.guard';
import { Argon2Service } from './services/argon2.service';
import { AuditService } from './services/audit.service';
import { AuthService } from './services/auth.service';
import { InviteService } from './services/invite.service';
import { MailService } from './services/mail.service';
import { PasswordPolicyService } from './services/password-policy.service';
import { RolesService } from './services/roles.service';
import { SessionsService } from './services/sessions.service';
import { TokenService } from './services/token.service';
import { UsersService } from './services/users.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    AuthController,
    UsersController,
    RolesController,
    SessionsController,
    AuditController,
  ],
  providers: [
    AuthService,
    UsersService,
    RolesService,
    SessionsService,
    AuditService,
    TokenService,
    Argon2Service,
    PasswordPolicyService,
    UserStatusGuard,
    MailService,
    InviteService,
  ],
  exports: [UsersService, RolesService, TokenService, UserStatusGuard],
})
export class IamModule {}
