import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { AuthenticatedUser } from './authenticated-user';

// Récupère l'utilisateur authentifié attaché par JwtStrategy.
// Usage : maRoute(@CurrentUser() user: AuthenticatedUser) { ... }
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthenticatedUser;
  },
);
