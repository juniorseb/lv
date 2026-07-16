import { ApiError } from './client';
import { authedRequest } from './http';
import {
  DriverDocument,
  DriverDocumentType,
  DriverProfile,
  MobileMoneyOperator,
  UpsertVehicleInput,
  Vehicle,
  VehicleType,
} from './types';

// Profils de rôle. Le module se concentre ici sur le profil livreur.
export const profilesApi = {
  // Renvoie null si le compte n'a pas encore de profil livreur (404).
  getMyDriverProfile: async (): Promise<DriverProfile | null> => {
    try {
      return await authedRequest<DriverProfile>('/profiles/driver/me');
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  createDriverProfile: (vehicleType: VehicleType, zones?: string[]) =>
    authedRequest<DriverProfile>('/profiles/driver', {
      method: 'POST',
      body: { vehicleType, ...(zones && zones.length ? { zones } : {}) },
    }),

  getDriverDocuments: () =>
    authedRequest<DriverDocument[]>('/profiles/driver/documents'),

  submitDriverDocument: (
    type: DriverDocumentType,
    url: string,
    dateExpiration?: string,
  ) =>
    authedRequest<DriverDocument>('/profiles/driver/documents', {
      method: 'POST',
      body: { type, url, ...(dateExpiration ? { dateExpiration } : {}) },
    }),

  getVehicle: () => authedRequest<Vehicle | null>('/profiles/driver/vehicle'),

  upsertVehicle: (input: UpsertVehicleInput) =>
    authedRequest<Vehicle>('/profiles/driver/vehicle', {
      method: 'POST',
      body: input,
    }),

  setMobileMoney: (
    operator: MobileMoneyOperator,
    number: string,
    holder: string,
  ) =>
    authedRequest<DriverProfile>('/profiles/driver/mobile-money', {
      method: 'POST',
      body: { operator, number, holder },
    }),

  // Multi-véhicules (P2).
  listVehicles: () => authedRequest<Vehicle[]>('/profiles/driver/vehicles'),

  addVehicle: (input: UpsertVehicleInput) =>
    authedRequest<Vehicle>('/profiles/driver/vehicles', {
      method: 'POST',
      body: input,
    }),

  activateVehicle: (id: string) =>
    authedRequest<Vehicle>(`/profiles/driver/vehicles/${id}/activate`, {
      method: 'POST',
    }),

  deleteVehicle: (id: string) =>
    authedRequest<void>(`/profiles/driver/vehicles/${id}`, {
      method: 'DELETE',
    }),
};
