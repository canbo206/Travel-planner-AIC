/** TanStack Query hooks for every API call the UI makes. */
import type {
  CreateTripInput,
  DiscoverQuery,
  Paginated,
  PlaceResult,
  PutStopsInput,
  RecreateTripInput,
  SignedUpload,
  TripDetail,
  TripSummary,
  UpdateTripInput,
} from '@roadtrip/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

export const keys = {
  discover: (q: Partial<DiscoverQuery>) => ['trips', 'discover', q] as const,
  trip: (id: string) => ['trips', id] as const,
  mine: ['me', 'trips'] as const,
  saved: ['me', 'saved'] as const,
};

export function useDiscover(query: Partial<DiscoverQuery>) {
  return useQuery({
    queryKey: keys.discover(query),
    queryFn: () => apiFetch<Paginated<TripSummary>>('/trips', { query }),
    placeholderData: keepPreviousData,
  });
}

export function useTrip(id: string | undefined) {
  return useQuery({
    queryKey: keys.trip(id ?? ''),
    queryFn: () => apiFetch<TripDetail>(`/trips/${id}`),
    enabled: Boolean(id),
  });
}

export function useMyTrips() {
  return useQuery({ queryKey: keys.mine, queryFn: () => apiFetch<TripSummary[]>('/me/trips') });
}

export function useSavedTrips() {
  return useQuery({ queryKey: keys.saved, queryFn: () => apiFetch<TripSummary[]>('/me/saved') });
}

export function usePlaceSearch(q: string, near?: { lat: number; lng: number }) {
  return useQuery({
    queryKey: ['geo', q, near?.lat, near?.lng],
    queryFn: () =>
      apiFetch<PlaceResult[]>('/geo/search', {
        query: { q, near: near ? `${near.lat},${near.lng}` : undefined },
      }),
    enabled: q.trim().length >= 2,
    staleTime: 5 * 60_000,
  });
}

/** After any write, put the fresh trip in the cache and refresh lists. */
function useTripWrite<TArgs>(fn: (args: TArgs) => Promise<TripDetail>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (trip) => {
      qc.setQueryData(keys.trip(trip.id), trip);
      qc.invalidateQueries({ queryKey: ['trips', 'discover'] });
      qc.invalidateQueries({ queryKey: keys.mine });
      qc.invalidateQueries({ queryKey: keys.saved });
    },
  });
}

export const useCreateTrip = () =>
  useTripWrite((input: CreateTripInput) => apiFetch<TripDetail>('/trips', { method: 'POST', body: input }));

export const useUpdateTrip = (id: string) =>
  useTripWrite((input: UpdateTripInput) =>
    apiFetch<TripDetail>(`/trips/${id}`, { method: 'PATCH', body: input }),
  );

export const usePutStops = (id: string) =>
  useTripWrite((input: PutStopsInput) =>
    apiFetch<TripDetail>(`/trips/${id}/stops`, { method: 'PUT', body: input }),
  );

export const useRecreateTrip = (id: string) =>
  useTripWrite((input: RecreateTripInput) =>
    apiFetch<TripDetail>(`/trips/${id}/recreate`, { method: 'POST', body: input }),
  );

export function useDeleteTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/trips/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useToggleSave(trip: TripDetail) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>(`/trips/${trip.id}/save`, { method: trip.isSaved ? 'DELETE' : 'POST' }),
    onSuccess: () => {
      qc.setQueryData<TripDetail>(keys.trip(trip.id), (t) => (t ? { ...t, isSaved: !t.isSaved } : t));
      qc.invalidateQueries({ queryKey: keys.saved });
    },
  });
}

/** Signed upload straight to storage, then record the photo on the stop. */
export function useUploadPhoto(tripId: string) {
  return useTripWrite(async ({ stopId, file }: { stopId: string; file: File }) => {
    const signed = await apiFetch<SignedUpload>('/uploads/sign', {
      method: 'POST',
      body: { tripId, stopId, contentType: file.type },
    });
    const put = await fetch(signed.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!put.ok) throw new Error('Upload failed');
    return apiFetch<TripDetail>(`/trips/${tripId}/stops/${stopId}/photos`, {
      method: 'POST',
      body: { url: signed.publicUrl },
    });
  });
}
