import { Injectable, Logger } from '@nestjs/common';

// Client du service de push Expo (https://exp.host).
//
// Pourquoi Expo plutôt que firebase-admin : l'app est une app Expo, et le jeton
// renvoyé par getDevicePushTokenAsync est un jeton FCM sur Android mais un jeton
// APNs BRUT sur iOS — que firebase-admin ne sait pas adresser. Expo relaie vers
// FCM et APNs derrière un seul format de jeton, donc un seul chemin de code.
//
// Les clés FCM/APNs se configurent une fois chez Expo (EAS), jamais ici : le
// backend n'a aucun secret à porter pour les push.
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Expo refuse les lots de plus de 100 messages.
const BATCH_SIZE = 100;

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: 'default';
  priority?: 'default' | 'normal' | 'high';
}

// Un « ticket » par message envoyé, dans l'ordre de la requête.
interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

export interface ExpoPushOutcome {
  sent: number;
  // Jetons devenus invalides (app désinstallée, réinstallée…) : à supprimer,
  // sinon la table des appareils enfle de jetons morts pour toujours.
  invalidTokens: string[];
}

@Injectable()
export class ExpoPushClient {
  private readonly logger = new Logger(ExpoPushClient.name);

  // Reconnaît le format Expo. Un jeton natif FCM/APNs passerait ici sans être
  // adressable : mieux vaut l'écarter tôt et le dire.
  static isExpoToken(token: string): boolean {
    return /^Expo(nent)?PushToken\[.+\]$/.test(token);
  }

  async send(messages: ExpoPushMessage[]): Promise<ExpoPushOutcome> {
    const outcome: ExpoPushOutcome = { sent: 0, invalidTokens: [] };

    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      const tickets = await this.postBatch(batch);
      if (!tickets) {
        continue; // lot perdu : best-effort, on n'interrompt pas les suivants
      }

      tickets.forEach((ticket, index) => {
        if (ticket.status === 'ok') {
          outcome.sent += 1;
          return;
        }
        // DeviceNotRegistered = l'appareil ne recevra plus jamais rien.
        if (ticket.details?.error === 'DeviceNotRegistered') {
          outcome.invalidTokens.push(batch[index].to);
        } else {
          this.logger.warn(
            `Push refusé par Expo (${ticket.details?.error ?? 'inconnu'}) : ${ticket.message}`,
          );
        }
      });
    }
    return outcome;
  }

  private async postBatch(
    batch: ExpoPushMessage[],
  ): Promise<ExpoPushTicket[] | null> {
    // Expo peut être lent ou injoignable : on abandonne plutôt que de retenir
    // l'action métier qui a déclenché la notification.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn(`Expo push HTTP ${res.status}`);
        return null;
      }
      const payload = (await res.json()) as { data?: ExpoPushTicket[] };
      return payload.data ?? null;
    } catch (error) {
      this.logger.warn(`Expo push injoignable : ${error}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
