import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Garde à poser sur les routes protégées : @UseGuards(JwtAuthGuard).
// S'appuie sur la stratégie 'jwt' (access token) enregistrée par le module auth.
// Sans dépendance d'injection propre, il est utilisable dans n'importe quel
// module sans créer de cycle avec le module auth.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
