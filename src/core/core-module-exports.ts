import { AuthService } from './services/auth.service';
import { UsersService } from './services/users.service';
import { UserRepository } from './repository/user.repository';

export class CoreModuleExports {
  static getExports() {
    return [
      AuthService,
      UsersService,
      UserRepository,
    ];
  }
}
