import { AuthService } from './services/auth.service';
import { UsersService } from './services/users.service';
import { MovementsService } from './services/movements.service';
import { TrainingSessionsService } from './services/training-sessions.service';
import { MailService } from './services/mail.service';
import { UserRepository } from './repository/user.repository';
import { MovementRepository } from './repository/movement.repository';
import { VideoRepository } from './repository/video.repository';
import { TrainingSessionRepository } from './repository/training-session.repository';
import { JwtAuthGuard } from './http/guards/jwt-auth.guard';

export class CoreModuleProviders {
  static getProviders() {
    return [
      AuthService,
      UsersService,
      MovementsService,
      TrainingSessionsService,
      MailService,
      UserRepository,
      MovementRepository,
      VideoRepository,
      TrainingSessionRepository,
      JwtAuthGuard,
    ];
  }
}
