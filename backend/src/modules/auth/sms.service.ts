import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Abstraction d'envoi de SMS. En V1, l'authentification passe par un OTP SMS
// (dossier §10 : « Twilio Verify ou agrégateur local »).
//
// Le fournisseur est sélectionné via SMS_PROVIDER :
//  - "console" (défaut en dev) : le code est écrit dans les logs, aucun SMS réel
//  - "twilio"  : à brancher sur l'API Twilio (laissé en TODO pour la V1)
//
// L'objectif ici est de fournir une couture propre : le reste de l'auth ne
// dépend jamais d'un fournisseur SMS concret.
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly provider: string;
  private readonly sender: string;

  constructor(private readonly config: ConfigService) {
    this.provider = (this.config.get<string>('SMS_PROVIDER') ?? 'console').toLowerCase();
    this.sender = this.config.get<string>('SMS_SENDER') ?? 'Livrechap';
  }

  /**
   * Envoie le code OTP au numéro fourni (déjà normalisé en E.164).
   * Le message suit le ton de marque : simple et direct (dossier §8).
   */
  async sendOtp(phoneNumber: string, code: string): Promise<void> {
    const message = `Livrechap : votre code de connexion est ${code}. Il expire dans quelques minutes. Ne le partagez avec personne.`;
    await this.send(phoneNumber, message);
  }

  // Envoi d'un SMS générique (ex. alerte Livrechap Protect au contact d'urgence).
  async sendMessage(phoneNumber: string, message: string): Promise<void> {
    await this.send(phoneNumber, message);
  }

  private async send(phoneNumber: string, message: string): Promise<void> {
    switch (this.provider) {
      case 'twilio':
        // TODO(V1) : brancher l'API Twilio (ou l'agrégateur local retenu).
        // On journalise et on évite de bloquer tant que le fournisseur réel
        // n'est pas configuré.
        this.logger.warn(
          `Fournisseur SMS "twilio" non encore branché — SMS non envoyé à ${phoneNumber}.`,
        );
        return;
      case 'console':
      default:
        // Mode développement : aucun SMS réel, le code est visible dans les logs
        // pour tester le parcours de bout en bout sans crédit SMS.
        this.logger.log(`[SMS console] à ${phoneNumber} (${this.sender}) : ${message}`);
        return;
    }
  }
}
