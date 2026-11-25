import React, { useRef, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  Map as GoogleMap,
  Pin,
} from '@vis.gl/react-google-maps';
import {
  Camera,
  Image as ImageIcon,
  Loader2,
  LocateFixed,
  MapPin,
  Trash2,
  X,
} from 'lucide-react';
import {
  ISSUE_CATEGORIES,
  ISSUE_PRIORITIES,
  SCHEMA_LIMITS,
  VILLAGE_CENTER,
  VILLAGE_WARDS,
  WARD_COORDINATES,
  type IssueCategory,
  type IssuePriority,
  type LatLngLiteral,
} from '../types';
import { useMapsApiKey } from '../hooks/useMapsApiKey';
import { compressIssueImage } from '../utils/imageCompress';
import { demoCreateServiceRequest } from '../utils/demoStore';
import { createServiceRequest } from '../utils/panchayatService';

interface ReportIssueSheetProps {
  open: boolean;
  onClose: () => void;
  reporterUid: string;
  reporterName: string;
  defaultWard: string;
  emailVerified: boolean;
  isDemoMode: boolean;
  onCreated: (requestId: string) => void;
}

export function ReportIssueSheet({
  open,
  onClose,
  reporterUid,
  reporterName,
  defaultWard,
  emailVerified,
  isDemoMode,
  onCreated,
}: ReportIssueSheetProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<IssueCategory>('Water Supply');
  const [ward, setWard] = useState(defaultWard || VILLAGE_WARDS[0]);
  const [landmark, setLandmark] = useState('');
  const [priority, setPriority] = useState<IssuePriority>('Medium');
  const [description, setDescription] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [photoMeta, setPhotoMeta] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinnedCoords, setPinnedCoords] = useState<LatLngLiteral | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [locatingGps, setLocatingGps] = useState(false);
  const { apiKey: mapsApiKey } = useMapsApiKey();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const handlePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setCompressing(true);
    try {
      const result = await compressIssueImage(file);
      setPhotoDataUrl(result.dataUrl);
      setPhotoMeta(`Compressed ${result.originalKB} KB -> ${result.compressedKB} KB`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process image.');
    } finally {
      setCompressing(false);
      e.target.value = '';
    }
  };

  const handleCaptureGps = () => {
    if (!('geolocation' in navigator)) {
      setError('GPS geolocation is not supported on this device.');
      return;
    }
    setLocatingGps(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPinnedCoords({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
        setLocatingGps(false);
      },
      () => {
        setError('Could not read GPS location. You can tap "Pin on Map" to mark the spot manually.');
        setLocatingGps(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const resetAndClose = () => {
    setTitle('');
    setLandmark('');
    setDescription('');
    setPhotoDataUrl('');
    setPhotoMeta(null);
    setPinnedCoords(null);
    setShowMapPicker(false);
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isDemoMode && !emailVerified) {
      setError('Please verify your email address before submitting a new service request.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title,
        description,
        category,
        ward,
        landmark,
        ...(pinnedCoords ? { lat: pinnedCoords.lat, lng: pinnedCoords.lng } : {}),
        priority,
        photoUrl: photoDataUrl,
        reporterUid,
        reporterName,
      };
      const requestId = isDemoMode
        ? demoCreateServiceRequest(payload)
        : await createServiceRequest(payload);
      resetAndClose();
      onCreated(requestId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit service request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-xs sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-issue-title"
    >
      <div className="w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Grab handle on mobile */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-slate-300" />
        </div>

        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200/80 flex items-center justify-between gap-4">
          <div>
            <h2 id="report-issue-title" className="font-display text-lg font-bold text-slate-900">
              Report Local Village Issue
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Attach a site photograph so ward officers can verify and dispatch repairs quickly.
            </p>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            aria-label="Close report form"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
              {error}
            </div>
          )}

          {/* Photo Evidence Upload */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Field Photograph (Recommended)
            </label>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoFile}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoFile}
              className="hidden"
            />

            {photoDataUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                <img
                  src={photoDataUrl}
                  alt="Selected village issue site preview"
                  referrerPolicy="no-referrer"
                  className="w-full h-48 object-cover"
                />
                <div className="px-3 py-2 bg-white border-t border-slate-200 flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-slate-600 truncate">
                    {photoMeta || 'Ready to upload'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoDataUrl('');
                      setPhotoMeta(null);
                    }}
                    className="min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-medium text-red-700 hover:bg-red-50 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={compressing}
                  onClick={() => cameraInputRef.current?.click()}
                  className="min-h-[84px] p-3 rounded-xl border border-dashed border-slate-300 hover:border-emerald-700 hover:bg-emerald-50/40 transition-colors flex flex-col items-center justify-center gap-1.5 text-slate-700"
                >
                  {compressing ? (
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-800" />
                  ) : (
                    <Camera className="w-5 h-5 text-emerald-800" />
                  )}
                  <span className="text-xs font-semibold">Take Photo</span>
                  <span className="text-[11px] text-slate-500">Use phone camera</span>
                </button>
                <button
                  type="button"
                  disabled={compressing}
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[84px] p-3 rounded-xl border border-dashed border-slate-300 hover:border-emerald-700 hover:bg-emerald-50/40 transition-colors flex flex-col items-center justify-center gap-1.5 text-slate-700"
                >
                  <ImageIcon className="w-5 h-5 text-emerald-800" />
                  <span className="text-xs font-semibold">Upload Image</span>
                  <span className="text-[11px] text-slate-500">Choose from gallery</span>
                </button>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="issue-title" className="block text-xs font-semibold text-slate-700">
              Issue Summary
            </label>
            <input
              id="issue-title"
              type="text"
              required
              minLength={SCHEMA_LIMITS.TITLE_MIN}
              maxLength={SCHEMA_LIMITS.TITLE_MAX}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Broken drinking water tap near Primary School"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="issue-category" className="block text-xs font-semibold text-slate-700">
                Service Category
              </label>
              <select
                id="issue-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as IssueCategory)}
                className="w-full min-h-[44px] px-3 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800"
              >
                {ISSUE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="issue-ward" className="block text-xs font-semibold text-slate-700">
                Ward Location
              </label>
              <select
                id="issue-ward"
                value={ward}
                onChange={(e) => setWard(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800"
              >
                {VILLAGE_WARDS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label htmlFor="issue-landmark" className="block text-xs font-semibold text-slate-700">
                Exact Landmark
              </label>
              <input
                id="issue-landmark"
                type="text"
                required
                minLength={SCHEMA_LIMITS.LANDMARK_MIN}
                maxLength={SCHEMA_LIMITS.LANDMARK_MAX}
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="e.g. Opposite Anganwadi gate, 2nd Cross"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="issue-priority" className="block text-xs font-semibold text-slate-700">
                Urgency
              </label>
              <select
                id="issue-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as IssuePriority)}
                className="w-full min-h-[44px] px-3 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800"
              >
                {ISSUE_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Optional Exact Map Coordinate Pinning */}
          <div className="space-y-2 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">
                Map Pin Coordinates (Optional)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={locatingGps}
                  onClick={handleCaptureGps}
                  className="min-h-[36px] px-3 py-1 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap disabled:opacity-60"
                >
                  {locatingGps ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-800" />
                  ) : (
                    <LocateFixed className="w-3.5 h-3.5 text-emerald-800" />
                  )}
                  Use My GPS
                </button>
                <button
                  type="button"
                  onClick={() => setShowMapPicker((prev) => !prev)}
                  className="min-h-[36px] px-3 py-1 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap"
                >
                  <MapPin className="w-3.5 h-3.5 text-emerald-800" />
                  {showMapPicker ? 'Hide Map' : 'Pin on Map'}
                </button>
              </div>
            </div>

            {pinnedCoords && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950">
                <span className="font-mono tabular-nums">
                  Pinned: {pinnedCoords.lat.toFixed(5)}, {pinnedCoords.lng.toFixed(5)}
                </span>
                <button
                  type="button"
                  onClick={() => setPinnedCoords(null)}
                  className="text-xs font-semibold text-emerald-900 hover:underline"
                >
                  Clear
                </button>
              </div>
            )}

            {showMapPicker && mapsApiKey && (
              <div className="w-full h-[220px] rounded-xl overflow-hidden border border-slate-300">
                <APIProvider apiKey={mapsApiKey} language="en" region="IN" libraries={['marker']}>
                  <GoogleMap
                    mapId="DEMO_MAP_ID"
                    internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                    defaultCenter={pinnedCoords || WARD_COORDINATES[ward] || VILLAGE_CENTER}
                    defaultZoom={15}
                    gestureHandling="greedy"
                    streetViewControl={false}
                    mapTypeControl={false}
                    className="w-full h-full"
                    onClick={(ev) => {
                      const latLng = ev.detail.latLng;
                      if (latLng) {
                        setPinnedCoords({
                          lat: Number(latLng.lat.toFixed(6)),
                          lng: Number(latLng.lng.toFixed(6)),
                        });
                      }
                    }}
                  >
                    {pinnedCoords && (
                      <AdvancedMarker position={pinnedCoords} title="Selected issue site">
                        <Pin background="#047857" borderColor="#064e3b" glyphColor="#ecfdf5" />
                      </AdvancedMarker>
                    )}
                  </GoogleMap>
                </APIProvider>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="issue-desc" className="block text-xs font-semibold text-slate-700">
              Detailed Description
            </label>
            <textarea
              id="issue-desc"
              rows={3}
              required
              minLength={SCHEMA_LIMITS.DESCRIPTION_MIN}
              maxLength={SCHEMA_LIMITS.DESCRIPTION_MAX}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe how long the issue has persisted and how many households are affected..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800 resize-none"
            />
          </div>

          {/* Sticky Action Footer inside form */}
          <div className="pt-2 pb-safe flex items-center justify-end gap-3 border-t border-slate-200/80">
            <button
              type="button"
              onClick={resetAndClose}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || compressing}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-900 text-white text-sm font-semibold hover:bg-emerald-800 transition-colors disabled:opacity-60"
            >
              {submitting ? 'Submitting...' : 'Submit Service Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
