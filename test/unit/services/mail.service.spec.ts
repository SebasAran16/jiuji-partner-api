import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test' }),
  })),
}));

import { MailService } from '../../../src/core/services/mail.service';

describe('MailService', () => {
  let service: MailService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                MAIL_HOST: 'smtp.test.com',
                MAIL_PORT: 587,
                FRONTEND_URL: 'https://test.jiujipartner.com',
                MAIL_FROM: 'test@jiujipartner.com',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(MailService);
    configService = module.get(ConfigService);
  });

  describe('sendVerificationEmail', () => {
    it('sends email with correct fields', async () => {
      await service.sendVerificationEmail('user@test.com', 'token-abc-123');

      const sendMail = (service as any).transporter.sendMail;
      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test@jiujipartner.com',
          to: 'user@test.com',
          subject: 'Verify your email - JiuJi Partner',
          html: expect.stringContaining('token-abc-123'),
        }),
      );
    });

    it('includes verification link in email body', async () => {
      await service.sendVerificationEmail('user@test.com', 'token-xyz');

      const sendMail = (service as any).transporter.sendMail;
      const callArgs = sendMail.mock.calls[0][0];

      expect(callArgs.html).toContain('https://test.jiujipartner.com/auth/verify-email?token=token-xyz');
    });
  });
});
