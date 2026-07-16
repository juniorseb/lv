import { User } from '../users/entities/user.entity';

// Vue back-office d'un utilisateur : contrairement à la vue publique, elle
// expose les URLs des documents (selfie, CNI) pour permettre la revue manuelle.
export interface AdminUserView {
  id: string;
  phoneNumber: string;
  fullName: string | null;
  commune: string | null;
  accountType: string;
  verificationLevel: string;
  selfieUrl: string | null;
  idDocumentUrl: string | null;
  idDocumentType: string | null;
  createdAt: Date;
}

export function toAdminUserView(user: User): AdminUserView {
  return {
    id: user.id,
    phoneNumber: user.phoneNumber,
    fullName: user.fullName,
    commune: user.commune,
    accountType: user.accountType,
    verificationLevel: user.verificationLevel,
    selfieUrl: user.selfieUrl,
    idDocumentUrl: user.idDocumentUrl,
    idDocumentType: user.idDocumentType,
    createdAt: user.createdAt,
  };
}
