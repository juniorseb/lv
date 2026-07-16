import { authedRequest } from './http';
import {
  ActiveTour,
  CreateTourInput,
  TourClient,
  TourFeedCard,
  TourOffer,
} from './types';

// Tournées (spec-delivery-architecture-tournees). Le client crée une tournée
// multi-arrêts ; le livreur la voit comme une mission unique.
export const toursApi = {
  // Client
  create: (input: CreateTourInput) =>
    authedRequest<TourClient>('/tours', { method: 'POST', body: input }),
  mine: () => authedRequest<TourClient[]>('/tours/mine'),
  get: (requestId: string) => authedRequest<TourClient>(`/tours/${requestId}`),

  // Livreur
  feed: () => authedRequest<TourFeedCard[]>('/tours/feed'),
  active: () => authedRequest<ActiveTour | null>('/tours/active'),
  accept: (routeId: string) =>
    authedRequest<ActiveTour>(`/tours/${routeId}/accept`, { method: 'POST' }),
  pickup: (routeId: string, proofPhotoUrl?: string) =>
    authedRequest<ActiveTour>(`/tours/${routeId}/pickup`, {
      method: 'POST',
      body: proofPhotoUrl ? { proofPhotoUrl } : {},
    }),
  completeStop: (stopId: string, code: string, proofPhotoUrl?: string) =>
    authedRequest<ActiveTour>(`/tours/stops/${stopId}/complete`, {
      method: 'POST',
      body: { code, ...(proofPhotoUrl ? { proofPhotoUrl } : {}) },
    }),
  reportProblem: (stopId: string, reason: string) =>
    authedRequest<ActiveTour>(`/tours/stops/${stopId}/problem`, {
      method: 'POST',
      body: { reason },
    }),

  // Négociation de prix
  proposeOffer: (routeId: string, prixProposeFcfa: number) =>
    authedRequest<TourOffer>(`/tours/${routeId}/offer`, {
      method: 'POST',
      body: { prixProposeFcfa },
    }),
  offers: (requestId: string) =>
    authedRequest<TourOffer[]>(`/tours/${requestId}/offers`),
  acceptOffer: (offerId: string) =>
    authedRequest<ActiveTour>(`/tours/offers/${offerId}/accept`, {
      method: 'POST',
    }),
  refuseOffer: (offerId: string) =>
    authedRequest<void>(`/tours/offers/${offerId}/refuse`, { method: 'POST' }),
};
