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
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

// Expo refuse les lots de plus de 100 messages.
const BATCH_SIZE = 100;

// Et pas plus de 1000 identifiants par demande de reçus.
const RECEIPT_BATCH_SIZE = 1000;

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

// Verdict définitif d'un push, rendu par Expo APRÈS coup.
interface ExpoPushReceipt {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

export interface AcceptedTicket {
  ticketId: string;
  token: string;
}

export interface ExpoPushOutcome {
  sent: number;
  // Jetons devenus invalides (app désinstallée, réinstallée…) : à supprimer,
  // sinon la table des appareils enfle de jetons morts pour toujours.
  invalidTokens: string[];
  // Tickets acceptés, dont le sort réel reste à vérifier via getReceipts.
  tickets: AcceptedTicket[];
}

export interface ReceiptVerdicts {
  // Reçus obtenus (livrés ou en erreur) : leurs tickets peuvent être oubliés.
  settled: string[];
  // Appareils que Expo déclare disparus : à purger.
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
    const outcome: ExpoPushOutcome = { sent: 0, invalidTokens: [], tickets: [] };

    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      const tickets = await this.postBatch(batch);
      if (!tickets) {
        continue; // lot perdu : best-effort, on n'interrompt pas les suivants
      }

      tickets.forEach((ticket, index) => {
        if (ticket.status === 'ok') {
          outcome.sent += 1;
          // « Accepté » ≠ « livré » : on garde le ticket pour réclamer le
          // verdict réel plus tard.
          if (ticket.id) {
            outcome.tickets.push({ ticketId: ticket.id, token: batch[index].to });
          }
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

  // Réclame le verdict de tickets déjà envoyés. `pending` associe chaque ticket
  // à son jeton, pour savoir quel appareil purger si Expo le déclare disparu.
  async fetchReceipts(
    pending: AcceptedTicket[],
  ): Promise<ReceiptVerdicts> {
    const verdicts: ReceiptVerdicts = { settled: [], invalidTokens: [] };
    const tokenOf = new Map(pending.map((p) => [p.ticketId, p.token]));
    const ids = [...tokenOf.keys()];

    for (let i = 0; i < ids.length; i += RECEIPT_BATCH_SIZE) {
      const batch = ids.slice(i, i + RECEIPT_BATCH_SIZE);
      const receipts = await this.postJson<Record<string, ExpoPushReceipt>>(
        EXPO_RECEIPTS_URL,
        { ids: batch },
      );
      if (!receipts) {
        continue; // Expo injoignable : on réessaiera au prochain passage
      }

      for (const [ticketId, receipt] of Object.entries(receipts)) {
        // Un reçu rendu, quel qu'il soit, clôt le ticket : rien à réclamer de
        // plus. Ceux qu'Expo ne renvoie pas encore restent en attente.
        verdicts.settled.push(ticketId);
        if (receipt.status === 'ok') {
          continue;
        }
        const error = receipt.details?.error;
        if (error === 'DeviceNotRegistered') {
          const token = tokenOf.get(ticketId);
          if (token) verdicts.invalidTokens.push(token);
          continue;
        }
        // MismatchSenderId = mauvaise clé FCM : TOUS les push Android échouent.
        // C'est le genre de panne invisible qui justifie à elle seule les reçus.
        this.logger.error(
          `Push NON livré (${error ?? 'inconnu'}) : ${receipt.message ?? ''}`,
        );
      }
    }
    return verdicts;
  }

  private postBatch(batch: ExpoPushMessage[]): Promise<ExpoPushTicket[] | null> {
    return this.postJson<ExpoPushTicket[]>(EXPO_PUSH_URL, batch);
  }

  // Expo peut être lent ou injoignable : on abandonne plutôt que de retenir
  // l'action métier qui a déclenché la notification. Renvoie null sur tout
  // échec — l'appelant décide (ignorer, ou réessayer plus tard).
  private async postJson<T>(url: string, body: unknown): Promise<T | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn(`Expo HTTP ${res.status} sur ${url}`);
        return null;
      }
      const payload = (await res.json()) as { data?: T };
      return payload.data ?? null;
    } catch (error) {
      this.logger.warn(`Expo injoignable (${url}) : ${error}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
