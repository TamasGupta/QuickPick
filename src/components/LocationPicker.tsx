"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search, Crosshair, Check } from "lucide-react";
import type { AddressSearchResult } from "@/lib/reverseGeocode";

// Leaflet's default marker icon references image paths that break under
// bundlers (a well-known gotcha) — point it at the icons copied into
// /public/leaflet instead of relying on Leaflet's own broken relative paths
// or an external CDN.
const markerIcon = L.icon({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Default map center when we have no GPS/existing pin to start from —
// Bengaluru, matching the demo store's city. Just a starting viewport; the
// buyer still has to place/confirm a real pin.
const FALLBACK_CENTER: [number, number] = [12.9716, 77.5946];

export interface PickedLocation {
  lat: number;
  lng: number;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

function ClickToPlace({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMove(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Imperatively re-centers the map when the pin moves via search/geolocation
// (a plain prop change on MapContainer doesn't move an already-mounted map).
function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], Math.max(map.getZoom(), 16));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);
  return null;
}

export function LocationPicker({
  initialLat,
  initialLng,
  onConfirm,
  onCancel,
}: {
  initialLat?: number | null;
  initialLng?: number | null;
  onConfirm: (loc: PickedLocation) => void;
  onCancel?: () => void;
}) {
  const [position, setPosition] = useState<{ lat: number; lng: number }>(() => ({
    lat: initialLat ?? FALLBACK_CENTER[0],
    lng: initialLng ?? FALLBACK_CENTER[1],
  }));
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [addr, setAddr] = useState<{ city: string | null; state: string | null; pincode: string | null } | null>(null);
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AddressSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  // Set right before pickResult() writes the picked label into `query` —
  // without this, the debounced search effect below would fire again on
  // that write and immediately repopulate the dropdown you just closed.
  const suppressNextSearchRef = useRef(false);

  // Reverse-geocode on every pin move, debounced so a drag isn't a request
  // per pixel — only settles 400ms after the pin stops moving.
  useEffect(() => {
    setResolving(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/geo/reverse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(position),
        });
        setAddr(res.ok ? await res.json() : null);
      } catch {
        setAddr(null);
      } finally {
        setResolving(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [position]);

  // Center on the buyer's real location on first load if no pin was already
  // saved — a cold Bengaluru default isn't useful if they're elsewhere.
  useEffect(() => {
    if (initialLat != null && initialLng != null) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(p);
        setFlyTarget(p);
      },
      () => {
        // No permission / unavailable — the fallback center stays, buyer
        // can still drag the pin or search manually.
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(p);
        setFlyTarget(p);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function runSearch() {
    if (!query.trim()) return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setSearching(true);
    try {
      const res = await fetch(`/api/geo/search?q=${encodeURIComponent(query.trim())}`);
      const json = await res.json();
      setResults(json.results ?? []);
    } finally {
      setSearching(false);
    }
  }

  // Live suggestions as you type, debounced so every keystroke doesn't fire
  // its own request — settles 400ms after typing pauses, same pattern as
  // the reverse-geocode-on-drag effect above. Enter/the search button
  // (runSearch) still search immediately, bypassing the wait.
  useEffect(() => {
    if (suppressNextSearchRef.current) {
      suppressNextSearchRef.current = false;
      return;
    }
    if (!query.trim()) {
      setResults([]);
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      runSearch();
    }, 400);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function pickResult(r: AddressSearchResult) {
    suppressNextSearchRef.current = true;
    setPosition({ lat: r.lat, lng: r.lng });
    setFlyTarget({ lat: r.lat, lng: r.lng });
    setResults([]);
    setQuery(r.label);
  }

  return (
    <div className="space-y-2">
      {/* A plain div, not a <form> — LocationPicker gets embedded inside
          other forms (checkout's add-address form, seller settings), and a
          nested <form> is invalid HTML: browsers silently drop it, so its
          submit button would actually submit the OUTER form instead of
          running this search. Enter-to-search and the button's onClick both
          just call runSearch() directly instead. */}
      <div className="relative flex gap-2">
        <input
          className="input flex-1 text-sm"
          placeholder="Search for an area, street, landmark…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              runSearch();
            }
          }}
        />
        <button type="button" onClick={runSearch} className="btn-outline shrink-0 px-3" disabled={searching}>
          <Search className="h-4 w-4" />
        </button>
        {results.length > 0 && (
          <ul className="absolute left-0 right-12 top-full z-[1000] mt-1 max-h-48 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-pop">
            {results.map((r, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => pickResult(r)}
                  className="block w-full truncate px-3 py-2 text-left text-xs hover:bg-gray-50"
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="relative h-64 w-full overflow-hidden rounded-xl border border-gray-200">
        <MapContainer center={[position.lat, position.lng]} zoom={16} className="h-full w-full">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <Marker
            position={[position.lat, position.lng]}
            icon={markerIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const m = e.target.getLatLng();
                setPosition({ lat: m.lat, lng: m.lng });
              },
            }}
          />
          <ClickToPlace onMove={(lat, lng) => setPosition({ lat, lng })} />
          {flyTarget && <FlyTo lat={flyTarget.lat} lng={flyTarget.lng} />}
        </MapContainer>
        <button
          type="button"
          onClick={useMyLocation}
          className="absolute bottom-2 right-2 z-[1000] flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-pop"
          title="Use my current location"
        >
          {locating ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          ) : (
            <Crosshair className="h-4 w-4 text-brand-600" />
          )}
        </button>
      </div>

      <p className="text-xs text-ink-soft">
        {resolving
          ? "Locating address…"
          : addr
            ? [addr.city, addr.state, addr.pincode].filter(Boolean).join(", ") || "Drag the pin to your exact spot"
            : "Drag the pin, tap the map, or search above to set your exact location"}
      </p>

      <div className="flex gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-outline flex-1">
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={() =>
            onConfirm({ lat: position.lat, lng: position.lng, city: addr?.city ?? null, state: addr?.state ?? null, pincode: addr?.pincode ?? null })
          }
          className="btn-primary flex-1"
        >
          <Check className="h-4 w-4" /> Confirm location
        </button>
      </div>
    </div>
  );
}
