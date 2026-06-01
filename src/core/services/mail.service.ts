import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST', 'mailpit'),
      port: this.configService.get<number>('MAIL_PORT', 1025),
      secure: false,
    });
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'https://dev.jiujipartner.com');
    const link = `${frontendUrl}/auth/verify-email?token=${token}`;

    await this.transporter.sendMail({
      from: this.configService.get<string>('MAIL_FROM', 'noreply@jiujipartner.com'),
      to: email,
      subject: 'Verify your email - JiuJi Partner',
      html: `
        <h1>Welcome to JiuJi Partner!</h1>
        <p>Click the link below to verify your email address:</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background-color:#000;color:#fff;text-decoration:none;border-radius:4px;">Verify Email</a>
        <p>This link expires in 30 minutes.</p>
      `,
    });

    this.logger.log(`Verification email sent to ${email}`);
  }
}
