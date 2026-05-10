import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.from = config.get<string>('SMTP_FROM') ?? 'noreply@sentient.dev';
  }

  onModuleInit(): void {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      this.logger.warn(
        'SMTP_HOST not configured — invite URLs will be logged to stdout (dev mode)',
      );
      return;
    }

    this.transporter = createTransport({
      host,
      port: this.config.get<number>('SMTP_PORT') ?? 587,
      secure: this.config.get<boolean>('SMTP_SECURE') ?? false,
      auth: {
        user: this.config.getOrThrow<string>('SMTP_USER'),
        pass: this.config.getOrThrow<string>('SMTP_PASS'),
      },
    });
  }

  async sendInvite(to: string, inviteUrl: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[INVITE] ${to} → ${inviteUrl}`);
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Welcome to Sentient — Set up your account',
      html: this.buildInviteHtml(inviteUrl),
      text: `Welcome to Sentient. Set up your account here: ${inviteUrl}\n\nThis link expires in 72 hours.`,
    });
  }

  private buildInviteHtml(inviteUrl: string): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:40px 0;margin:0">
  <table width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
    <tr><td style="background:#1a1a2e;padding:24px 32px">
      <h1 style="color:#fff;margin:0;font-size:22px">Sentient HRIS</h1>
    </td></tr>
    <tr><td style="padding:32px">
      <h2 style="color:#1a1a2e;margin-top:0">Welcome — your account is ready</h2>
      <p style="color:#555;line-height:1.6">
        An administrator has created an account for you on Sentient. Click the button below
        to set your password and activate your account.
      </p>
      <div style="text-align:center;margin:32px 0">
        <a href="${inviteUrl}"
           style="background:#4f46e5;color:#fff;padding:14px 32px;border-radius:6px;
                  text-decoration:none;font-weight:bold;display:inline-block">
          Set up my account
        </a>
      </div>
      <p style="color:#888;font-size:13px">
        This link expires in 72 hours. If you did not expect this email, you can safely ignore it.
      </p>
    </td></tr>
    <tr><td style="background:#f9f9f9;padding:16px 32px;color:#aaa;font-size:12px;text-align:center">
      Sentient HRIS — confidential
    </td></tr>
  </table>
</body>
</html>`;
  }
}
