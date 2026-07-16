import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { AuthenticatedUser } from './authenticated-user';

// Garde des routes back-office : valide le JWT (stratégie 'jwt') puis exige que
// l'utilisateur soit administrateur. À poser sur les contrôleurs /admin.
@Injectable()
export class AdminGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authenticated = (await super.canActivate(context)) as boolean;
    if (!authenticated) {
      return false;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user?.isAdmin) {
      throw new ForbiddenException('Accès réservé aux administrateurs.');
    }
    return true;
  }
}
