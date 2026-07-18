// Maximum distance (km) a buyer's delivery address may be from the seller's
// store for an order to be allowed.
export const MAX_DELIVERY_RADIUS_KM = 10;

// Great-circle distance between two lat/lng points, in kilometers
// (Haversine formula — accurate enough for a same-city delivery radius;
// no need for anything fancier like a routing-distance API here).
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371; // Earth radius, km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
