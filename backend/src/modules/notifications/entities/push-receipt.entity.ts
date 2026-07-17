import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

// Ticket Expo en attente de verdict.
//
// Expo répond en deux temps : à l'envoi il rend un « ticket » qui dit seulement
// « accepté, je m'en occupe » ; le sort réel du push (livré, appareil disparu,
// clé FCM invalide…) n'est connu qu'ensuite, via un « reçu » à réclamer avec
// l'identifiant du ticket.
//
// Sans cette table, un push perdu l'est en silence — et surtout, une erreur de
// configuration (MismatchSenderId : mauvaise clé FCM) ferait échouer TOUS les
// push Android sans qu'aucun log ne le dise.
//
// Les lignes sont éphémères : supprimées dès le verdict rendu.
@Entity('push_receipts')
export class PushReceipt {
  // L'identifiant du ticket rendu par Expo fait office de clé : il est unique
  // et c'est lui qu'on présente pour réclamer le reçu.
  @PrimaryColumn({ name: 'ticket_id', type: 'varchar', length: 100 })
  ticketId: string;

  // Conservé pour pouvoir purger l'appareil si le reçu dit qu'il n'existe plus.
  @Column({ name: 'token', type: 'text' })
  token: string;

  // Expo demande d'attendre avant de réclamer un reçu : cette date dit quand le
  // ticket devient réclamable.
  @Index('idx_push_receipts_created_at')
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
