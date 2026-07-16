import { authedRequest } from './http';
import { IdDocumentType, User, UserRole } from './types';

// Gestion du compte : onboarding Niveau 1 (nom, commune, selfie) et demande de
// vérification Niveau 2 (pièce d'identité). Renvoient la vue publique à jour.
export const usersApi = {
  updateProfile: (body: {
    fullName?: string;
    commune?: string;
    email?: string;
    dateNaissance?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  }) => authedRequest<User>('/users/me', { method: 'PATCH', body }),

  setSelfie: (selfieUrl: string) =>
    authedRequest<User>('/users/me/selfie', {
      method: 'PUT',
      body: { selfieUrl },
    }),

  submitIdDocument: (documentUrl: string, documentType: IdDocumentType) =>
    authedRequest<User>('/users/me/id-document', {
      method: 'PUT',
      body: { documentUrl, documentType },
    }),

  getMe: () => authedRequest<User>('/users/me'),

  // Rôle affiché au lancement de l'app (persisté serveur).
  setActiveRole: (activeRole: UserRole) =>
    authedRequest<User>('/users/me/active-role', {
      method: 'PATCH',
      body: { activeRole },
    }),
};
