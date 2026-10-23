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
import { MovementSuggestionsController } from './http/controller/movement-suggestions.controller';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueueAsync({
      name: 'video-import',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        // One job per video. Retries only make sense at video granularity:
        // transient failures (network, model busy) self-heal via backoff.
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: 100,
          removeOnFail: 1000,
          // Without this, one hung ffmpeg/Whisper/Ollama call stalls the whole
          // backlog forever at concurrency 1. Bull only MARKS the job failed at
          // this deadline — it does not stop the work, so VideoImportProcessor
          // pairs it with an AbortSignal that actually cancels each operation.
          timeout: Number(
            configService.get<string>('VIDEO_IMPORT_JOB_TIMEOUT_MS', '2700000'),
          ),
        },
      }),
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
  controllers: [AppController, AuthController, UsersController, MovementsController, TrainingSessionsController, VideosController, AiController, MovementSuggestionsController],
  providers: [...CoreModuleProviders.getProviders()],
  exports: [...CoreModuleExports.getExports()],
})
export class CoreModule {}
