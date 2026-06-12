import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserIdentity } from '../../../../const';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UserIdentity => {
    return context.switchToHttp().getRequest()['user'];
  },
);
