import { AuthService } from './services/auth.service';
import { UsersService } from './services/users.service';
import { MovementsService } from './services/movements.service';
import { TrainingSessionsService } from './services/training-sessions.service';
import { VideosService } from './services/videos.service';
import { ImportService } from './services/import.service';
import { GoogleDriveService } from './services/google-drive.service';
import { MailService } from './services/mail.service';
import { LlmService } from './services/llm.service';
import { VectorStoreService } from './services/vector-store.service';
import { TranscriptionService } from './services/transcription.service';
import { MediaService } from './services/media.service';
import { AiService } from './services/ai.service';
import { MovementSuggestionsService } from './services/movement-suggestions.service';
import { UserRepository } from './repository/user.repository';
import { MovementRepository } from './repository/movement.repository';
import { VideoRepository } from './repository/video.repository';
import { TrainingSessionRepository } from './repository/training-session.repository';
import { MovementSuggestionRepository } from './repository/movement-suggestion.repository';
import { VideoMovementRepository } from './repository/video-movement.repository';
import { JwtAuthGuard } from './http/guards/jwt-auth.guard';
import { RolesGuard } from './http/guards/roles.guard';
import { VideoImportProcessor } from './queues/video-import.processor';

export class CoreModuleProviders {
  static getProviders() {
    return [
      AuthService,
      UsersService,
      MovementsService,
      TrainingSessionsService,
      VideosService,
      ImportService,
      GoogleDriveService,
      MailService,
      LlmService,
      VectorStoreService,
      TranscriptionService,
      MediaService,
      AiService,
      MovementSuggestionsService,
      UserRepository,
      MovementRepository,
      VideoRepository,
      TrainingSessionRepository,
      MovementSuggestionRepository,
      VideoMovementRepository,
      JwtAuthGuard,
      RolesGuard,
      VideoImportProcessor,
    ];
  }
}

