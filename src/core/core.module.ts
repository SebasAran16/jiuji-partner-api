import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { CoreModuleProviders } from './core-module-providers';
import { CoreModuleExports } from './core-module-exports';
import { AppController } from './http/controller/app.controller';
import { AuthController } from './http/controller/auth.controller';
import { UsersController } from './http/controller/users.controller';
import { MovementsController } from './http/controller/movements.controller';

@Module({
  imports: [
    ConfigModule,
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
  controllers: [AppController, AuthController, UsersController, MovementsController],
  providers: [...CoreModuleProviders.getProviders()],
  exports: [...CoreModuleExports.getExports()],
})
export class CoreModule {}
