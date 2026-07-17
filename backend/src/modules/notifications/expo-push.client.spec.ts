import { ExpoPushClient, ExpoPushMessage } from './expo-push.client';

// On simule les réponses d'Expo : aucun appel réseau ne doit partir d'un test.
function mockFetch(responses: unknown[]): jest.Mock {
  const fn = jest.fn();
  responses.forEach((body) =>
    fn.mockResolvedValueOnce({
      ok: true,
      json: async () => body,
    }),
  );
  return fn;
}

const msg = (to: string): ExpoPushMessage => ({
  to,
  title: 'Nouvelle mission',
  body: 'Course de 1500 FCFA',
});

describe('ExpoPushClient.isExpoToken', () => {
  it('reconnaît les jetons Expo', () => {
    expect(ExpoPushClient.isExpoToken('ExponentPushToken[abc123]')).toBe(true);
    expect(ExpoPushClient.isExpoToken('ExpoPushToken[abc123]')).toBe(true);
  });

  it('rejette un jeton natif FCM ou APNs', () => {
    // Le piège d'origine : un jeton APNs brut passait pour valide et n'était
    // jamais adressable. Il doit être écarté avant l'envoi.
    expect(ExpoPushClient.isExpoToken('fA1b2C3d4:APA91bE...')).toBe(false);
    expect(ExpoPushClient.isExpoToken('740f4707bebcf74f9b7c25d4'.repeat(2))).toBe(
      false,
    );
    expect(ExpoPushClient.isExpoToken('')).toBe(false);
  });
});

describe('ExpoPushClient.send', () => {
  const original = global.fetch;
  afterEach(() => {
    global.fetch = original;
  });

  it('compte les envois réussis', async () => {
    global.fetch = mockFetch([
      { data: [{ status: 'ok', id: '1' }, { status: 'ok', id: '2' }] },
    ]) as never;

    const out = await new ExpoPushClient().send([msg('A'), msg('B')]);
    expect(out.sent).toBe(2);
    expect(out.invalidTokens).toEqual([]);
  });

  it('remonte les jetons d’appareils désinstallés, pour purge', async () => {
    global.fetch = mockFetch([
      {
        data: [
          { status: 'ok', id: '1' },
          {
            status: 'error',
            message: 'not registered',
            details: { error: 'DeviceNotRegistered' },
          },
        ],
      },
    ]) as never;

    const out = await new ExpoPushClient().send([
      msg('ExponentPushToken[vivant]'),
      msg('ExponentPushToken[mort]'),
    ]);
    expect(out.sent).toBe(1);
    // Sans cette purge, la table des appareils enfle de jetons morts à vie.
    expect(out.invalidTokens).toEqual(['ExponentPushToken[mort]']);
  });

  it('ne purge PAS sur une erreur passagère', async () => {
    global.fetch = mockFetch([
      {
        data: [
          {
            status: 'error',
            message: 'too many requests',
            details: { error: 'MessageRateExceeded' },
          },
        ],
      },
    ]) as never;

    const out = await new ExpoPushClient().send([msg('ExponentPushToken[a]')]);
    // Un throttling n'est pas un appareil mort : on ne supprime rien.
    expect(out.invalidTokens).toEqual([]);
    expect(out.sent).toBe(0);
  });

  it('découpe en lots de 100 (limite d’Expo)', async () => {
    const ok100 = { data: Array.from({ length: 100 }, () => ({ status: 'ok' })) };
    const ok50 = { data: Array.from({ length: 50 }, () => ({ status: 'ok' })) };
    const fetchMock = mockFetch([ok100, ok50]);
    global.fetch = fetchMock as never;

    const out = await new ExpoPushClient().send(
      Array.from({ length: 150 }, (_, i) => msg(`ExponentPushToken[${i}]`)),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(out.sent).toBe(150);
  });

  it('ne jette jamais si Expo est injoignable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ENOTFOUND')) as never;
    // Best-effort : un push perdu ne doit pas faire échouer la livraison.
    const out = await new ExpoPushClient().send([msg('ExponentPushToken[a]')]);
    expect(out.sent).toBe(0);
    expect(out.invalidTokens).toEqual([]);
  });

  it('ne jette jamais sur une réponse HTTP en erreur', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 502 }) as never;
    const out = await new ExpoPushClient().send([msg('ExponentPushToken[a]')]);
    expect(out.sent).toBe(0);
  });
});
