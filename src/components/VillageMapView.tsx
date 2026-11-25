import React, { useCallback, useMemo, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  ChevronRight,
  Compass,
  ExternalLink,
  Loader2,
  LocateFixed,
  MapPin,
  Search,
} from 'lucide-react';
import {
  formatTimestamp,
  getRequestCoordinates,
  VILLAGE_CENTER,
  type LatLngLiteral,
  type ServiceRequest,
} from '../types';
import { useMapsApiKey } from '../hooks/useMapsApiKey';
import { getStatusTextClass } from './RequestDetailSheet';
import { SafeImage } from './SafeImage';

interface GroundedPlace {
  title: string;
  uri: string;
  placeId?: string;
  reviewSnippets: Array<{ text: string; uri?: string }>;
}

interface GroundingResult {
  answer: string;
  places: GroundedPlace[];
  coordinates: LatLngLiteral;
}

interface VillageMapViewProps {
  requests: ServiceRequest[];
  onSelectRequest: (req: ServiceRequest) => void;
  compact?: boolean;
}

const CIVIC_QUICK_QUERIES = [
  'Nearest Primary Health Center and government clinics',
  'Water supply and borewell repair offices nearby',
  'Electricity board sub-station and repair office nearby',
  'Plumbing, hardware, and electrical supply stores nearby',
];

function getPinStyle(req: ServiceRequest): {
  background: string;
  borderColor: string;
  glyphColor: string;
} {
  if (req.status === 'Resolved' || req.status === 'Closed') {
    return { background: '#047857', borderColor: '#064e3b', glyphColor: '#ecfdf5' };
  }
  if (req.status === 'In Progress') {
    return { background: '#d97706', borderColor: '#92400e', glyphColor: '#fffbeb' };
  }
  if (req.status === 'Verified') {
    return { background: '#0284c7', borderColor: '#075985', glyphColor: '#f0f9ff' };
  }
  if (req.priority === 'Urgent' || req.priority === 'High') {
    return { background: '#dc2626', borderColor: '#991b1b', glyphColor: '#fef2f2' };
  }
  return { background: '#334155', borderColor: '#0f172a', glyphColor: '#f8fafc' };
}

function MapPanController({ target }: { target: LatLngLiteral | null }) {
  const map = useMap();
  React.useEffect(() => {
    if (!map || !target) return;
    map.panTo(target);
    map.setZoom(15);
  }, [map, target]);
  return null;
}

export function VillageMapView({
  requests,
  onSelectRequest,
  compact = false,
}: VillageMapViewProps) {
  const { apiKey, loading: keyLoading } = useMapsApiKey();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<LatLngLiteral | null>(null);
  const [panTarget, setPanTarget] = useState<LatLngLiteral | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationMsg, setLocationMsg] = useState<string | null>(null);

  // Nearby civic facilities (Google Maps Grounding via server-side Gemini API)
  const [groundingQuery, setGroundingQuery] = useState('');
  const [groundingLoading, setGroundingLoading] = useState(false);
  const [groundingError, setGroundingError] = useState<string | null>(null);
  const [groundingResult, setGroundingResult] = useState<GroundingResult | null>(null);

  const mappedRequests = useMemo(
    () =>
      requests.map((req) => ({
        req,
        position: getRequestCoordinates(req),
      })),
    [requests],
  );

  const activeEntry = useMemo(
    () => mappedRequests.find((entry) => entry.req.id === selectedId) || null,
    [mappedRequests, selectedId],
  );

  const handleLocateMe = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocationMsg('GPS geolocation is not available in this browser.');
      return;
    }
    setLocating(true);
    setLocationMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        };
        setUserLocation(coords);
        setPanTarget(coords);
        setLocationMsg(`Centered on your GPS (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`);
        setLocating(false);
      },
      () => {
        setLocationMsg('Location permission unavailable. Showing Shantinagar ward coordinates.');
        setPanTarget(VILLAGE_CENTER);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const runMapsGrounding = useCallback(
    async (queryText: string) => {
      const cleaned = queryText.trim();
      if (cleaned.length < 2) return;
      setGroundingQuery(cleaned);
      setGroundingLoading(true);
      setGroundingError(null);

      const coords = userLocation || VILLAGE_CENTER;
      try {
        const res = await fetch('/api/gemini/maps-grounding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: cleaned,
            lat: coords.lat,
            lng: coords.lng,
          }),
        });

        const data = (await res.json().catch(() => ({}))) as {
          answer?: string;
          places?: GroundedPlace[];
          coordinates?: LatLngLiteral;
          status?: string;
          error?: string;
        };

        // Tier 2 Quota Defense: check HTTP 429 or RESOURCE_EXHAUSTED
        if (res.status === 429 || data?.status === 'RESOURCE_EXHAUSTED') {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          setGroundingError('Google Maps quota limit reached. Please try again later.');
          return;
        }

        if (!res.ok) {
          setGroundingError(data?.error || 'Could not retrieve nearby civic locations.');
          return;
        }

        setGroundingResult({
          answer: typeof data.answer === 'string' ? data.answer : '',
          places: Array.isArray(data.places) ? data.places : [],
          coordinates: data.coordinates || coords,
        });
      } catch {
        setGroundingError('Network error while checking nearby civic facilities.');
      } finally {
        setGroundingLoading(false);
      }
    },
    [userLocation],
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runMapsGrounding(groundingQuery);
  };

  return (
    <div className="space-y-6">
      {/* Interactive Village Issue Map */}
      <section className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-mono text-emerald-800 font-medium">
              Spatial Service Register · Wards 1–6
            </p>
            <h2 className="font-display text-lg font-bold text-slate-900 mt-0.5">
              GramDev Interactive Village Map
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tap any marker to inspect villager photos, repair budgets, and ward officer progress.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={locating}
              onClick={handleLocateMe}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors flex items-center gap-1.5 whitespace-nowrap disabled:opacity-60"
            >
              {locating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-800" />
              ) : (
                <LocateFixed className="w-3.5 h-3.5 text-emerald-800" />
              )}
              Use My GPS
            </button>
            <button
              type="button"
              onClick={() => setPanTarget({ ...VILLAGE_CENTER })}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              Center Village
            </button>
          </div>
        </div>

        {/* Status Legend Strip */}
        <div className="px-4 sm:px-5 py-2.5 bg-slate-50/70 border-b border-slate-200/70 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600" aria-hidden="true" />
              Urgent / High Submitted
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-600" aria-hidden="true" />
              Verified
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600" aria-hidden="true" />
              In Progress
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-700" aria-hidden="true" />
              Resolved
            </span>
          </div>
          <span className="font-mono tabular-nums text-slate-500">
            {locationMsg || `${mappedRequests.length} pinned tickets`}
          </span>
        </div>

        {/* Explicit-Height Map Canvas Container (prevents CF2 height collapse) */}
        <div className={compact ? 'w-full h-[420px] sm:h-[460px]' : 'w-full h-[460px] sm:h-[520px]'}>
          {keyLoading ? (
            <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-500 text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-800" />
              <span>Loading Google Maps...</span>
            </div>
          ) : !apiKey ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 p-6 text-center space-y-2">
              <MapPin className="w-7 h-7 text-slate-400" />
              <p className="text-sm font-semibold text-slate-800">
                Google Maps API key not detected in this runtime
              </p>
              <p className="text-xs text-slate-500 max-w-md">
                Configure <span className="font-mono">VITE_GOOGLE_MAPS_API_KEY</span> or restart the
                development server after provisioning Google Maps to render live ward pins.
              </p>
            </div>
          ) : (
            <APIProvider apiKey={apiKey} language="en" region="IN" libraries={['marker']}>
              <GoogleMap
                mapId="DEMO_MAP_ID"
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                defaultCenter={VILLAGE_CENTER}
                defaultZoom={14}
                gestureHandling="greedy"
                mapTypeControl
                streetViewControl={false}
                fullscreenControl
                className="w-full h-full"
                onClick={() => setSelectedId(null)}
              >
                <MapPanController target={panTarget} />

                {userLocation && (
                  <AdvancedMarker position={userLocation} title="Your GPS Location">
                    <div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-md" />
                  </AdvancedMarker>
                )}

                {mappedRequests.map(({ req, position }) => {
                  const pinStyle = getPinStyle(req);
                  return (
                    <AdvancedMarker
                      key={req.id}
                      position={position}
                      title={`${req.trackingCode}: ${req.title}`}
                      onClick={() => setSelectedId(req.id)}
                    >
                      <Pin
                        background={pinStyle.background}
                        borderColor={pinStyle.borderColor}
                        glyphColor={pinStyle.glyphColor}
                      />
                    </AdvancedMarker>
                  );
                })}

                {activeEntry && (
                  <InfoWindow
                    position={activeEntry.position}
                    onCloseClick={() => setSelectedId(null)}
                    pixelOffset={[0, -34]}
                  >
                    <div className="w-64 space-y-2.5 p-0.5 text-slate-900">
                      {activeEntry.req.photoUrl && (
                        <div className="h-28 w-full rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                          <SafeImage
                            src={activeEntry.req.photoUrl}
                            alt={activeEntry.req.title}
                            fallbackLabel={activeEntry.req.category}
                          />
                        </div>
                      )}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-slate-500">
                          <span className="font-mono font-semibold text-slate-800">
                            {activeEntry.req.trackingCode}
                          </span>
                          <span>·</span>
                          <span className={`font-semibold ${getStatusTextClass(activeEntry.req.status)}`}>
                            {activeEntry.req.status}
                          </span>
                          <span>·</span>
                          <span>{activeEntry.req.priority}</span>
                        </div>
                        <p className="text-sm font-bold leading-snug text-slate-900 line-clamp-2">
                          {activeEntry.req.title}
                        </p>
                        <p className="text-xs text-slate-600 line-clamp-1">
                          {activeEntry.req.ward} · {activeEntry.req.landmark}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Logged {formatTimestamp(activeEntry.req.createdAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectRequest(activeEntry.req);
                          setSelectedId(null);
                        }}
                        className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-900 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors flex items-center justify-center gap-1"
                      >
                        Inspect Ticket
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            </APIProvider>
          )}
        </div>
      </section>

      {/* Nearby Civic Facilities & Emergency Support (Google Maps Grounding) */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-xs font-mono text-emerald-800 font-medium">
              Google Maps Grounding · Verified Real-World Directory
            </p>
            <h2 className="font-display text-lg font-bold text-slate-900 mt-0.5">
              Find Nearby Civic Facilities & Repair Suppliers
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Look up real health centers, water offices, electricity sub-stations, or hardware
              stores near your ward with live Google Maps links.
            </p>
          </div>
          <Compass className="w-5 h-5 text-emerald-800 hidden sm:block shrink-0" />
        </div>

        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={groundingQuery}
              onChange={(e) => setGroundingQuery(e.target.value)}
              placeholder="e.g. Nearest government primary health center or plumbing supply store"
              aria-label="Search nearby civic facilities on Google Maps"
              className="w-full min-h-[44px] pl-10 pr-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800"
            />
          </div>
          <button
            type="submit"
            disabled={groundingLoading || groundingQuery.trim().length < 2}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-900 text-white text-sm font-semibold hover:bg-emerald-800 transition-colors disabled:opacity-60 whitespace-nowrap flex items-center justify-center gap-2"
          >
            {groundingLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching Maps...
              </>
            ) : (
              'Search Nearby'
            )}
          </button>
        </form>

        {/* Actionable Quick-Lookup Buttons */}
        <div className="flex flex-wrap gap-2">
          {CIVIC_QUICK_QUERIES.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={groundingLoading}
              onClick={() => void runMapsGrounding(preset)}
              className="min-h-[36px] px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-xs font-medium text-slate-700 hover:text-emerald-900 transition-colors text-left"
            >
              {preset}
            </button>
          ))}
        </div>

        {groundingError && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
            {groundingError}
          </div>
        )}

        {groundingResult && (
          <div className="pt-4 border-t border-slate-200/80 space-y-4">
            {groundingResult.answer && (
              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {groundingResult.answer}
              </div>
            )}

            {groundingResult.places.length > 0 ? (
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-slate-900">
                  Verified Google Maps Locations ({groundingResult.places.length})
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {groundingResult.places.map((place) => (
                    <div
                      key={place.uri}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-2"
                    >
                      <div className="space-y-1">
                        <a
                          href={place.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-semibold text-emerald-900 hover:underline inline-flex items-center gap-1.5"
                        >
                          <span>{place.title}</span>
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        </a>
                        {place.reviewSnippets.length > 0 && (
                          <p className="text-xs text-slate-600 line-clamp-2 italic">
                            &ldquo;{place.reviewSnippets[0].text}&rdquo;
                          </p>
                        )}
                      </div>
                      <a
                        href={place.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-slate-600 hover:text-emerald-900 inline-flex items-center gap-1"
                      >
                        Open directions on Google Maps
                        <ChevronRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No direct Google Maps place cards were attached for this query. Try broadening the
                facility name or centering on your GPS location.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
