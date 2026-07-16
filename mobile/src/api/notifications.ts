import { authedRequest } from './http';

type Platform = 'android' | 'ios' | 'web';

export const notificationsApi = {
  registerDevice: (token: string, platform: Platform) =>
    authedRequest<void>('/notifications/devices', {
      method: 'POST',
      body: { token, platform },
    }),

  unregisterDevice: (token: string) =>
    authedRequest<void>('/notifications/devices', {
      method: 'DELETE',
      body: { token },
    }),
};
