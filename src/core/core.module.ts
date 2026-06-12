import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bull';
import { CoreModuleProviders } from './core-module-providers';
import { CoreModuleExports } from './core-module-exports';
import { AppController } from './http/controller/app.controller';
import { AuthController } from './http/controller/auth.controller';
import { UsersController } from './http/controller/users.controller';
import { MovementsController } from './http/controller/movements.controller';
import { TrainingSessionsController } from './http/controller/training-sessions.controller';
import { VideosController } from './http/controller/videos.controller';
import { AiController } from './http/controller/ai.controller';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: 'video-import',
      // One job per video. Retries only make sense at video granularity:
      // transient failures (network, model busy) self-heal via backoff.
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.getOrThrow<string>('JWT_SECRET');
        const expiresIn = configService.get<string>('JWT_EXPIRATION', '7d');
        return { secret, signOptions: { expiresIn } as any };
      },
    }),
  ],
  controllers: [AppController, AuthController, UsersController, MovementsController, TrainingSessionsController, VideosController, AiController],
  providers: [...CoreModuleProviders.getProviders()],
  exports: [...CoreModuleExports.getExports()],
})
export class CoreModule {}
