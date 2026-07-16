import { authedRequest } from './http';
import { CreateSavedAddressInput, SavedAddress } from './types';

// Adresses enregistrées du client (spec-app-navigation-roles §3).
export const addressesApi = {
  list: () => authedRequest<SavedAddress[]>('/users/me/addresses'),

  create: (input: CreateSavedAddressInput) =>
    authedRequest<SavedAddress>('/users/me/addresses', {
      method: 'POST',
      body: input,
    }),

  remove: (id: string) =>
    authedRequest<void>(`/users/me/addresses/${id}`, { method: 'DELETE' }),
};
