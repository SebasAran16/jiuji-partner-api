import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { getQueueToken } from '@nestjs/bull';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import cookieParser from 'cookie-parser';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      const allowed = ['http://localhost:3000', 'http://localhost', 'http://127.0.0.1:3000', 'http://127.0.0.1', 'http://dev.jiujipartner.com', 'http://dev-api.jiujipartner.com', 'https://dev.jiujipartner.com', 'https://dev-api.jiujipartner.com'];
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.use(cookieParser());

  const configService = app.get(ConfigService);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('JiuJi Partner API')
    .setDescription('Jiu-Jitsu Training Companion API')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT-auth')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Bull Board queue dashboard (protected behind JWT + ADMIN role)
  const jwtService = app.get(JwtService);
  const queue = app.get(getQueueToken('video-import'));

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [new BullAdapter(queue)],
    serverAdapter,
  });

  app.use('/admin/queues', (req: Request, res: Response, next: NextFunction) => {
    const token =
      req.headers.authorization?.replace('Bearer ', '') ||
      (typeof req.query.token === 'string' ? req.query.token : null) ||
      req.cookies?.admin_token;

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const payload = jwtService.verify(token);
      if (payload.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Forbidden' });
      }
      // Always refresh the cookie from a fresh, verified query token — even if a
      // (possibly stale/expired) admin_token cookie already exists. The board's
      // sub-resource and /api/queues XHRs carry no ?token=, so they fall back to
      // the cookie; a stale cookie would 401 every one of them and leave the UI
      // stuck on "Loading". Overwriting it on each visit makes that self-heal.
      if (typeof req.query.token === 'string') {
        res.cookie('admin_token', token, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/admin/queues',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
      }
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  });

  app.use('/admin/queues', serverAdapter.getRouter());

  const port = configService.get<number>('PORT', 3001);
  await app.listen(port);
  console.log(`JiuJi Partner API running on port ${port}`);
}

void bootstrap();

