import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import {
  formatINR,
  formatTimestampWithTime,
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  SCHEMA_LIMITS,
  type AccessRole,
  type IssuePriority,
  type IssueStatus,
  type RoleLabel,
  type ServiceRequest,
  type ServiceUpdate,
} from '../types';
import { compressIssueImage } from '../utils/imageCompress';
import { demoDeleteRequest, demoUpdateRequestProgress } from '../utils/demoStore';
import {
  deleteServiceRequest,
  subscribeRequestUpdates,
  updateServiceRequestProgress,
} from '../utils/panchayatService';
import { SafeImage } from './SafeImage';

interface RequestDetailSheetProps {
  request: ServiceRequest | null;
  onClose: () => void;
  activeMode: AccessRole;
  actualRole: AccessRole;
  actorUid: string;
  actorName: string;
  actorRoleLabel: RoleLabel;
  isDemoMode: boolean;
  demoUpdates?: ServiceUpdate[];
  onDeleted: () => void;
}

export function getStatusTextClass(status: IssueStatus): string {
  switch (status) {
    case 'Resolved':
    case 'Closed':
      return 'text-emerald-700';
    case 'In Progress':
      return 'text-amber-700';
    case 'Verified':
      return 'text-sky-700';
    default:
      return 'text-slate-700';
  }
}

export function RequestDetailSheet({
  request,
  onClose,
  activeMode,
  actualRole,
  actorUid,
  actorName,
  actorRoleLabel,
  isDemoMode,
  demoUpdates,
  onDeleted,
}: RequestDetailSheetProps) {
  const [updates, setUpdates] = useState<ServiceUpdate[]>([]);
  const [status, setStatus] = useState<IssueStatus>('Submitted');
  const [priority, setPriority] = useState<IssuePriority>('Medium');
  const [assignedOfficerName, setAssignedOfficerName] = useState('');
  const [officerNotes, setOfficerNotes] = useState('');
  const [estimatedBudget, setEstimatedBudget] = useState('0');
  const [resolutionPhotoUrl, setResolutionPhotoUrl] = useState('');
  const [compressing, setCompressing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resPhotoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!request) return;
    setStatus(request.status);
    setPriority(request.priority);
    setAssignedOfficerName(request.assignedOfficerName || actorName);
    setOfficerNotes(request.officerNotes || '');
    setEstimatedBudget(String(request.estimatedBudget || 0));
    setResolutionPhotoUrl(request.resolutionPhotoUrl || '');
    setFeedback(null);
    setError(null);
    setConfirmDelete(false);

    if (isDemoMode) {
      setUpdates(demoUpdates || []);
      return;
    }

    const unsub = subscribeRequestUpdates(request.id, (items) => {
      setUpdates(items);
    });
    return () => unsub();
  }, [request, actorName, isDemoMode, demoUpdates]);

  if (!request) return null;

  const canActAsOfficer =
    (activeMode === 'authorized' || activeMode === 'admin') &&
    (actualRole === 'authorized' || actualRole === 'admin');
  const isAdminStaff = activeMode === 'admin' && actualRole === 'admin';
  const isLockedTerminal = request.status === 'Closed' && !isAdminStaff;

  const allowedStatuses: IssueStatus[] = isAdminStaff
    ? ISSUE_STATUSES
    : ISSUE_STATUSES.filter((s) => s !== 'Closed');

  const handleResolutionPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    setError(null);
    try {
      const res = await compressIssueImage(file);
      setResolutionPhotoUrl(res.dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compress photo.');
    } finally {
      setCompressing(false);
      e.target.value = '';
    }
  };

  const handleSaveProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const payload = {
        request,
        newStatus: status,
        priority,
        assignedOfficerUid: actorUid,
        assignedOfficerName: assignedOfficerName.trim() || actorName,
        officerNotes,
        estimatedBudget: Number(estimatedBudget) || 0,
        resolutionPhotoUrl,
        actorUid,
        actorName,
        actorRoleLabel,
      };
      if (isDemoMode) {
        demoUpdateRequestProgress(payload);
      } else {
        await updateServiceRequestProgress(payload);
      }
      setFeedback('Progress saved and real-time update sent to the villager.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update service request.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isAdminStaff) return;
    setDeleting(true);
    setError(null);
    try {
      if (isDemoMode) {
        demoDeleteRequest(request.id);
      } else {
        await deleteServiceRequest(request.id);
      }
      onDeleted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete record.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-xs sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-title"
    >
      <div className="w-full sm:max-w-3xl bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden">
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-slate-300" />
        </div>

        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200/80 flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
              <span className="font-mono font-semibold text-slate-700 tabular-nums">
                {request.trackingCode}
              </span>
              <span aria-hidden="true">·</span>
              <span>{request.category}</span>
              <span aria-hidden="true">·</span>
              <span className={`font-semibold ${getStatusTextClass(request.status)}`}>
                {request.status}
              </span>
              <span aria-hidden="true">·</span>
              <span>{request.priority} Priority</span>
            </div>
            <h2 id="detail-title" className="font-display text-lg sm:text-xl font-bold text-slate-900">
              {request.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close issue details"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-6">
          {/* Photos Grid */}
          {(request.photoUrl || request.resolutionPhotoUrl) && (
            <div
              className={`grid gap-4 ${
                request.photoUrl && request.resolutionPhotoUrl
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : 'grid-cols-1'
              }`}
            >
              {request.photoUrl && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-600">
                    Villager Reported Site Photo
                  </p>
                  <div className="aspect-[16/10] rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                    <SafeImage
                      src={request.photoUrl}
                      alt={`Villager site photo for ${request.title}`}
                    />
                  </div>
                </div>
              )}
              {request.resolutionPhotoUrl && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-emerald-800">
                    Officer Field Verification / Resolution Photo
                  </p>
                  <div className="aspect-[16/10] rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                    <SafeImage
                      src={request.resolutionPhotoUrl}
                      alt={`Resolution photo for ${request.title}`}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Description & Metadata */}
          <div className="space-y-4">
            <p className="text-sm text-slate-700 leading-relaxed">{request.description}</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-slate-200/80 text-xs">
              <div className="space-y-1">
                <span className="text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Ward & Landmark
                </span>
                <p className="font-semibold text-slate-900">{request.ward}</p>
                <p className="text-slate-600">{request.landmark}</p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500">Reported By</span>
                <p className="font-semibold text-slate-900">{request.reporterName}</p>
                <p className="font-mono text-slate-600 tabular-nums">
                  {formatTimestampWithTime(request.createdAt)}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" /> Assigned Officer
                </span>
                <p className="font-semibold text-slate-900">
                  {request.assignedOfficerName || 'Pending assignment'}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500">Sanctioned Estimate</span>
                <p className="font-mono font-semibold text-slate-900 tabular-nums">
                  {request.estimatedBudget > 0 ? formatINR(request.estimatedBudget) : 'Not allocated'}
                </p>
              </div>
            </div>
          </div>

          {/* Authorized Officer / Administrative Staff Action Panel */}
          {canActAsOfficer && (
            <form
              onSubmit={handleSaveProgress}
              className="p-4 sm:p-5 rounded-2xl bg-[#F6F8F6] border border-slate-200/80 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900">
                    {isAdminStaff ? 'Administrative Staff Action' : 'Field Officer Inspection Update'}
                  </h3>
                  <p className="text-xs text-slate-600">
                    Updating status automatically notifies {request.reporterName} in real time.
                  </p>
                </div>
                {isLockedTerminal && (
                  <span className="text-xs font-medium text-amber-800">
                    Closed ticket — only Administrative Staff can reopen
                  </span>
                )}
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                  {error}
                </div>
              )}
              {feedback && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
                  <span>{feedback}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label htmlFor="upd-status" className="block text-xs font-semibold text-slate-700">
                    Status Stage
                  </label>
                  <select
                    id="upd-status"
                    disabled={isLockedTerminal}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as IssueStatus)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 disabled:bg-slate-100"
                  >
                    {allowedStatuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="upd-priority" className="block text-xs font-semibold text-slate-700">
                    Priority
                  </label>
                  <select
                    id="upd-priority"
                    disabled={isLockedTerminal}
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as IssuePriority)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 disabled:bg-slate-100"
                  >
                    {ISSUE_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="upd-budget" className="block text-xs font-semibold text-slate-700">
                    Budget Allocation (INR)
                  </label>
                  <input
                    id="upd-budget"
                    type="number"
                    min={0}
                    max={SCHEMA_LIMITS.BUDGET_MAX}
                    disabled={isLockedTerminal}
                    value={estimatedBudget}
                    onChange={(e) => setEstimatedBudget(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-mono tabular-nums text-slate-900 disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="upd-officer" className="block text-xs font-semibold text-slate-700">
                    Assigned Officer / Crew
                  </label>
                  <input
                    id="upd-officer"
                    type="text"
                    maxLength={SCHEMA_LIMITS.DISPLAY_NAME_MAX}
                    disabled={isLockedTerminal}
                    value={assignedOfficerName}
                    onChange={(e) => setAssignedOfficerName(e.target.value)}
                    placeholder="e.g. K. Manjunath (Water Technician)"
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 disabled:bg-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Verification / After-Work Photo
                  </label>
                  <input
                    ref={resPhotoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleResolutionPhoto}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isLockedTerminal || compressing}
                    onClick={() => resPhotoInputRef.current?.click()}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {compressing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4 text-emerald-800" />
                    )}
                    <span>
                      {resolutionPhotoUrl ? 'Replace Resolution Photo' : 'Attach Resolution Photo'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="upd-notes" className="block text-xs font-semibold text-slate-700">
                  Field Inspection & Progress Remark
                </label>
                <textarea
                  id="upd-notes"
                  rows={2}
                  maxLength={SCHEMA_LIMITS.OFFICER_NOTES_MAX}
                  disabled={isLockedTerminal}
                  value={officerNotes}
                  onChange={(e) => setOfficerNotes(e.target.value)}
                  placeholder="Enter inspection findings, work completed, or timeline for the villager..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 resize-none disabled:bg-slate-100"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                {isAdminStaff ? (
                  confirmDelete ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-700 font-medium">Delete permanently?</span>
                      <button
                        type="button"
                        disabled={deleting}
                        onClick={handleDelete}
                        className="min-h-[40px] px-3 py-1.5 rounded-lg bg-red-700 text-white text-xs font-semibold hover:bg-red-800"
                      >
                        {deleting ? 'Deleting...' : 'Confirm Delete'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium text-red-700 hover:bg-red-50 flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove Record
                    </button>
                  )
                ) : (
                  <span />
                )}

                <button
                  type="submit"
                  disabled={saving || compressing || isLockedTerminal}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-900 text-white text-sm font-semibold hover:bg-emerald-800 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving Update...' : 'Save & Notify Villager'}
                </button>
              </div>
            </form>
          )}

          {/* Chronological Audit Timeline */}
          <div className="space-y-3 pb-safe">
            <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              Progress Audit Trail ({updates.length})
            </h3>
            {updates.length === 0 ? (
              <p className="text-xs text-slate-500 py-3">
                No status updates logged yet. Field updates will appear here in real time.
              </p>
            ) : (
              <ol className="divide-y divide-slate-200/80 border-t border-slate-200/80">
                {updates.map((upd) => (
                  <li key={upd.id} className="py-3.5 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5 text-slate-700">
                        <span className="font-semibold text-slate-900">{upd.authorName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-slate-500">{upd.authorRole}</span>
                        <span aria-hidden="true">·</span>
                        <span className={`font-semibold ${getStatusTextClass(upd.newStatus)}`}>
                          {upd.previousStatus === upd.newStatus
                            ? upd.newStatus
                            : `${upd.previousStatus} -> ${upd.newStatus}`}
                        </span>
                      </div>
                      <span className="font-mono text-slate-500 tabular-nums">
                        {formatTimestampWithTime(upd.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">{upd.note}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
