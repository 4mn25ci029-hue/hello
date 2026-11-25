import { useMemo, useState } from 'react';
import {
  Camera,
  ChevronRight,
  Database,
  Filter,
  LayoutList,
  Map as MapIcon,
  MapPin,
  Plus,
  RotateCcw,
  Search,
} from 'lucide-react';
import {
  formatINR,
  formatTimestamp,
  GENERATED_ASSETS,
  ISSUE_CATEGORIES,
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  VILLAGE_WARDS,
  type AccessRole,
  type IssueCategory,
  type IssuePriority,
  type IssueStatus,
  type ServiceRequest,
} from '../types';
import { getStatusTextClass } from './RequestDetailSheet';
import { SafeImage } from './SafeImage';
import { VillageMapView } from './VillageMapView';

interface DashboardViewProps {
  requests: ServiceRequest[];
  loading: boolean;
  activeMode: AccessRole;
  actualRole: AccessRole;
  currentUserUid: string;
  onOpenReportModal: () => void;
  onSelectRequest: (req: ServiceRequest) => void;
  onSeedSampleData: () => Promise<void>;
  seeding: boolean;
}

export function DashboardView({
  requests,
  loading,
  activeMode,
  actualRole,
  currentUserUid,
  onOpenReportModal,
  onSelectRequest,
  onSeedSampleData,
  seeding,
}: DashboardViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | IssueStatus | 'ActionNeeded'>('All');
  const [categoryFilter, setCategoryFilter] = useState<'All' | IssueCategory>('All');
  const [priorityFilter, setPriorityFilter] = useState<'All' | IssuePriority>('All');
  const [wardFilter, setWardFilter] = useState<'All' | string>('All');
  const [onlyMine, setOnlyMine] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const isAdminStaff = activeMode === 'admin' && actualRole === 'admin';
  const isOfficerView = activeMode === 'authorized' || activeMode === 'admin';

  const metrics = useMemo(() => {
    const total = requests.length;
    const submitted = requests.filter((r) => r.status === 'Submitted').length;
    const activeWork = requests.filter(
      (r) => r.status === 'Verified' || r.status === 'In Progress',
    ).length;
    const resolved = requests.filter(
      (r) => r.status === 'Resolved' || r.status === 'Closed',
    ).length;
    const resolutionPct = total > 0 ? Math.round((resolved / total) * 100) : 0;
    const totalBudget = requests.reduce((sum, r) => sum + (Number(r.estimatedBudget) || 0), 0);
    return { total, submitted, activeWork, resolved, resolutionPct, totalBudget };
  }, [requests]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search.trim()) count++;
    if (statusFilter !== 'All') count++;
    if (categoryFilter !== 'All') count++;
    if (priorityFilter !== 'All') count++;
    if (wardFilter !== 'All') count++;
    if (onlyMine) count++;
    return count;
  }, [search, statusFilter, categoryFilter, priorityFilter, wardFilter, onlyMine]);

  const clearAllFilters = () => {
    setSearch('');
    setStatusFilter('All');
    setCategoryFilter('All');
    setPriorityFilter('All');
    setWardFilter('All');
    setOnlyMine(false);
  };

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (onlyMine && r.reporterUid !== currentUserUid) return false;
      if (categoryFilter !== 'All' && r.category !== categoryFilter) return false;
      if (priorityFilter !== 'All' && r.priority !== priorityFilter) return false;
      if (wardFilter !== 'All' && r.ward !== wardFilter) return false;
      if (statusFilter === 'ActionNeeded') {
        if (r.status === 'Resolved' || r.status === 'Closed') return false;
      } else if (statusFilter !== 'All' && r.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.trackingCode.toLowerCase().includes(q) ||
        r.ward.toLowerCase().includes(q) ||
        r.landmark.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.priority.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q) ||
        r.assignedOfficerName.toLowerCase().includes(q)
      );
    });
  }, [
    requests,
    search,
    statusFilter,
    categoryFilter,
    priorityFilter,
    wardFilter,
    onlyMine,
    currentUserUid,
  ]);

  const modeHeading =
    activeMode === 'admin'
      ? 'GramDev Administrative Control Desk'
      : activeMode === 'authorized'
        ? 'Ward Officer Field Inspection Queue'
        : 'GramDev Gram Panchayat Service Tracker';

  const modeSubcopy =
    activeMode === 'admin'
      ? 'Review every ward ticket, sanction repair budgets, override terminal records, and monitor transparency metrics across the village.'
      : activeMode === 'authorized'
        ? 'Inspect villager-uploaded site photographs, verify field issues, update repair progress, and dispatch real-time status notifications.'
        : 'Report local water, road, streetlight, or sanitation issues with a photo from your phone and track real-time Panchayat resolution progress.';

  return (
    <div className="space-y-8">
      {/* Hero Banner Split (1 Focal Anchor) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6">
          <div className="space-y-3">
            <p className="text-xs font-mono text-emerald-800 font-medium">
              {activeMode === 'admin'
                ? 'Mode 03 · Administrative Staff'
                : activeMode === 'authorized'
                  ? 'Mode 02 · Authorized Field Officer'
                  : 'Mode 01 · Public Citizen Portal'}
            </p>
            <h1 className="font-display text-2xl sm:text-4xl font-bold text-slate-900 leading-tight">
              {modeHeading}
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
              {modeSubcopy}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenReportModal}
              className="min-h-[46px] px-5 py-2.5 rounded-xl bg-emerald-900 text-white text-sm font-semibold hover:bg-emerald-800 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Camera className="w-4 h-4" />
              Report Issue with Photo
            </button>
            {isOfficerView && (
              <button
                type="button"
                onClick={() =>
                  setStatusFilter((prev) => (prev === 'ActionNeeded' ? 'All' : 'ActionNeeded'))
                }
                className={`min-h-[46px] px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors whitespace-nowrap ${
                  statusFilter === 'ActionNeeded'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {statusFilter === 'ActionNeeded' ? 'Showing Open Queue' : 'Filter Open Queue'}
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 relative rounded-2xl overflow-hidden border border-slate-200/80 min-h-[220px] bg-slate-100">
          <SafeImage
            src={GENERATED_ASSETS.heroPanchayat}
            alt="Shantinagar Gram Panchayat civic office courtyard"
            className="w-full h-full object-cover"
            fallbackLabel="Shantinagar Gram Panchayat"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
            <p className="text-xs font-mono text-emerald-200">GramDev Helpdesk · Wards 1–6</p>
            <p className="text-sm font-semibold mt-0.5">
              Open Monday–Saturday · Real-time photo verification active
            </p>
          </div>
        </div>
      </section>

      {/* 4-Column Full-Width KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-1">
          <p className="text-xs text-slate-500">Total Service Requests</p>
          <p className="font-mono text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
            {metrics.total}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {metrics.submitted} awaiting verification
          </p>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-1">
          <p className="text-xs text-slate-500">Verified & In Progress</p>
          <p className="font-mono text-2xl sm:text-3xl font-bold text-amber-700 tabular-nums">
            {metrics.activeWork}
          </p>
          <p className="text-xs text-slate-500">Assigned to ward teams</p>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-1">
          <p className="text-xs text-slate-500">Resolved Issues</p>
          <p className="font-mono text-2xl sm:text-3xl font-bold text-emerald-800 tabular-nums">
            {metrics.resolved}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {metrics.resolutionPct}% overall resolution rate
          </p>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-1">
          <p className="text-xs text-slate-500">Sanctioned Works</p>
          <p className="font-mono text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
            {formatINR(metrics.totalBudget)}
          </p>
          <p className="text-xs text-slate-500">Logged across public register</p>
        </div>
      </section>

      {/* Search Bar & Multi-Filter Control Surface */}
      <section className="space-y-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-4">
          {/* Top Row: Search Input + Category, Priority, Ward Dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-4 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ID, title, ward, landmark, officer..."
                aria-label="Search service requests"
                className="w-full min-h-[44px] pl-10 pr-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800"
              />
            </div>

            <div className="md:col-span-3">
              <select
                aria-label="Filter by category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as 'All' | IssueCategory)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800"
              >
                <option value="All">All Categories</option>
                {ISSUE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <select
                aria-label="Filter by priority"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as 'All' | IssuePriority)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800"
              >
                <option value="All">All Priorities</option>
                {ISSUE_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p} Priority
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <select
                aria-label="Filter by ward name"
                value={wardFilter}
                onChange={(e) => setWardFilter(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800"
              >
                <option value="All">All Wards</option>
                {VILLAGE_WARDS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Bottom Row: Status Segmented Tabs + My Reports + Reset + Count */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1 border-t border-slate-100">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
              {(['All', ...ISSUE_STATUSES] as const).map((st) => {
                const active = statusFilter === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3">
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                Showing {filteredRequests.length} of {requests.length} requests
              </span>

              <div className="flex items-center gap-2">
                <div
                  className="inline-flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-xl"
                  role="group"
                  aria-label="Toggle list or map view"
                >
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`min-h-[34px] px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap ${
                      viewMode === 'list'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <LayoutList className="w-3.5 h-3.5" />
                    List
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('map')}
                    className={`min-h-[34px] px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap ${
                      viewMode === 'map'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <MapIcon className="w-3.5 h-3.5" />
                    Map
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setOnlyMine((prev) => !prev)}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap ${
                    onlyMine
                      ? 'bg-emerald-900 text-white border-emerald-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  My Reports
                </button>

                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset ({activeFilterCount})
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Service Requests List / Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden animate-pulse"
              >
                <div className="h-44 bg-slate-200/70" />
                <div className="p-5 space-y-3">
                  <div className="h-3 w-36 bg-slate-200 rounded" />
                  <div className="h-5 w-3/4 bg-slate-200 rounded" />
                  <div className="h-3 w-full bg-slate-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl py-16 px-6 text-center space-y-4">
            <Filter className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="space-y-1">
              <h2 className="font-display text-lg font-bold text-slate-900">
                No service requests logged yet
              </h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Start by reporting a village water, road, streetlight, or sanitation issue with a photo.
                {isAdminStaff
                  ? ' As Administrative Staff, you can also load sample Panchayat records to preview the full register.'
                  : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={onOpenReportModal}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-900 text-white text-sm font-semibold hover:bg-emerald-800 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Report First Issue
              </button>
              {isAdminStaff && (
                <button
                  type="button"
                  disabled={seeding}
                  onClick={() => void onSeedSampleData()}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2 disabled:opacity-60"
                >
                  <Database className="w-4 h-4" />
                  {seeding ? 'Loading Records...' : 'Load Sample Panchayat Records'}
                </button>
              )}
            </div>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl py-12 px-6 text-center space-y-2">
            <h2 className="font-display text-base font-bold text-slate-900">
              No matching service requests
            </h2>
            <p className="text-xs text-slate-500">
              Adjust your search text or reset the status, category, priority, and ward filters.
            </p>
            <button
              type="button"
              onClick={clearAllFilters}
              className="mt-2 min-h-[40px] px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              Reset All Filters
            </button>
          </div>
        ) : viewMode === 'map' ? (
          <VillageMapView
            requests={filteredRequests}
            onSelectRequest={onSelectRequest}
            compact
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRequests.map((req) => (
              <article
                key={req.id}
                className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden flex flex-col hover:border-slate-300 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onSelectRequest(req)}
                  className="text-left flex-1 flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-800"
                >
                  {req.photoUrl ? (
                    <div className="aspect-[16/10] w-full bg-slate-100 overflow-hidden border-b border-slate-200/60">
                      <SafeImage
                        src={req.photoUrl}
                        alt={`Site photo for ${req.title}`}
                        fallbackLabel={req.category}
                      />
                    </div>
                  ) : (
                    <div className="h-24 w-full bg-gradient-to-br from-slate-50 to-emerald-50/50 border-b border-slate-200/60 px-5 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">
                        Text report · No photo attached
                      </span>
                      <span className="text-xs font-mono text-slate-400 tabular-nums">
                        {req.trackingCode}
                      </span>
                    </div>
                  )}

                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div className="space-y-2">
                      {/* Zero-pill quiet metadata line */}
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500">
                        <span className="font-mono font-semibold text-slate-700 tabular-nums">
                          {req.trackingCode}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{req.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className={`font-semibold ${getStatusTextClass(req.status)}`}>
                          {req.status}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            req.priority === 'Urgent'
                              ? 'font-semibold text-red-700'
                              : req.priority === 'High'
                                ? 'font-semibold text-amber-700'
                                : 'text-slate-600'
                          }
                        >
                          {req.priority}
                        </span>
                      </div>

                      <h3 className="font-display text-base font-bold text-slate-900 leading-snug line-clamp-2">
                        {req.title}
                      </h3>

                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {req.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">{req.ward}</span>
                      </span>
                      <span className="flex items-center gap-1 font-medium text-emerald-800 whitespace-nowrap shrink-0">
                        {isOfficerView ? 'Inspect' : formatTimestamp(req.createdAt)}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
