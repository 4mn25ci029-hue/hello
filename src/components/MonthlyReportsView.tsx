import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CheckCircle2, Download, FileSpreadsheet, Printer } from 'lucide-react';
import {
  formatINR,
  formatMonthLabel,
  formatTimestamp,
  getCurrentMonthKey,
  ISSUE_CATEGORIES,
  SCHEMA_LIMITS,
  VILLAGE_WARDS,
  type AccessRole,
  type MonthlyReport,
  type ServiceRequest,
} from '../types';
import { demoPublishMonthlyReport } from '../utils/demoStore';
import { publishMonthlyReport } from '../utils/panchayatService';

interface MonthlyReportsViewProps {
  requests: ServiceRequest[];
  reports: MonthlyReport[];
  activeMode: AccessRole;
  actualRole: AccessRole;
  actorUid: string;
  actorName: string;
  isDemoMode: boolean;
}

export function MonthlyReportsView({
  requests,
  reports,
  activeMode,
  actualRole,
  actorUid,
  actorName,
  isDemoMode,
}: MonthlyReportsViewProps) {
  const isAdminStaff = activeMode === 'admin' && actualRole === 'admin';
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [summaryText, setSummaryText] = useState(
    'Monthly Gram Panchayat review covering water supply, road patching, solar street lighting, and sanitation works across all six wards.',
  );
  const [actionPlan, setActionPlan] = useState(
    'Prioritize verified urgent drainage and road repairs before the next Gram Sabha meeting and complete pending ward inspections within 7 working days.',
  );
  const [publishing, setPublishing] = useState(false);
  const [publishFeedback, setPublishFeedback] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const availableMonths = useMemo(() => {
    const set = new Set<string>([getCurrentMonthKey()]);
    for (const r of requests) set.add(r.monthKey);
    for (const rep of reports) set.add(rep.monthKey);
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [requests, reports]);

  const monthRequests = useMemo(
    () => requests.filter((r) => r.monthKey === selectedMonth),
    [requests, selectedMonth],
  );

  const liveStats = useMemo(() => {
    const total = monthRequests.length;
    const resolved = monthRequests.filter(
      (r) => r.status === 'Resolved' || r.status === 'Closed',
    ).length;
    const inProgress = monthRequests.filter((r) => r.status === 'In Progress').length;
    const verified = monthRequests.filter((r) => r.status === 'Verified').length;
    const pending = monthRequests.filter((r) => r.status === 'Submitted').length;
    const budget = monthRequests.reduce((acc, r) => acc + (Number(r.estimatedBudget) || 0), 0);
    const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    return { total, resolved, inProgress, verified, pending, budget, rate };
  }, [monthRequests]);

  const categoryChartData = useMemo(() => {
    return ISSUE_CATEGORIES.map((cat) => {
      const catReqs = monthRequests.filter((r) => r.category === cat);
      const resolved = catReqs.filter(
        (r) => r.status === 'Resolved' || r.status === 'Closed',
      ).length;
      return {
        category: cat.replace(' & ', '/').replace('Street Lighting', 'Lighting'),
        Total: catReqs.length,
        Resolved: resolved,
      };
    });
  }, [monthRequests]);

  const wardTableData = useMemo(() => {
    return VILLAGE_WARDS.map((ward) => {
      const wardReqs = monthRequests.filter((r) => r.ward === ward);
      const resolved = wardReqs.filter(
        (r) => r.status === 'Resolved' || r.status === 'Closed',
      ).length;
      const open = wardReqs.length - resolved;
      const budget = wardReqs.reduce((s, r) => s + (Number(r.estimatedBudget) || 0), 0);
      return { ward, total: wardReqs.length, resolved, open, budget };
    });
  }, [monthRequests]);

  const activePublishedReport = reports.find((rep) => rep.monthKey === selectedMonth);

  const handlePublishReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminStaff) return;
    setPublishing(true);
    setPublishFeedback(null);
    setPublishError(null);
    try {
      const payload = {
        monthKey: selectedMonth,
        requests,
        summaryText,
        actionPlan,
        actorUid,
        actorName,
      };
      if (isDemoMode) {
        demoPublishMonthlyReport(payload);
      } else {
        await publishMonthlyReport(payload);
      }
      setPublishFeedback(
        `Official ${formatMonthLabel(selectedMonth)} transparency report published and villagers notified.`,
      );
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Could not publish report.');
    } finally {
      setPublishing(false);
    }
  };

  const handleDownloadCSV = () => {
    const header = [
      'Tracking Code',
      'Month',
      'Category',
      'Ward',
      'Landmark',
      'Title',
      'Status',
      'Priority',
      'Assigned Officer',
      'Sanctioned Budget (INR)',
    ];
    const rows = monthRequests.map((r) => [
      r.trackingCode,
      r.monthKey,
      r.category,
      r.ward,
      r.landmark,
      r.title,
      r.status,
      r.priority,
      r.assignedOfficerName || 'Unassigned',
      String(r.estimatedBudget || 0),
    ]);
    const csv = [header, ...rows]
      .map((cols) =>
        cols.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','),
      )
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gramdev-panchayat-report-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Header & Month Selector */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-mono text-slate-500">Public Accountability Ledger</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
            Monthly Transparency Reports
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            Live service request performance, ward-wise completion rates, and sanctioned expenditure published for Gram Sabha transparency.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 no-print">
          <select
            aria-label="Select report month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900"
          >
            {availableMonths.map((mk) => (
              <option key={mk} value={mk}>
                {formatMonthLabel(mk)}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleDownloadCSV}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-900 text-white text-sm font-medium hover:bg-emerald-800 transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            Print Statement
          </button>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-1">
          <p className="text-xs text-slate-500">Requests Logged ({formatMonthLabel(selectedMonth)})</p>
          <p className="font-mono text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
            {liveStats.total}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {liveStats.pending} new · {liveStats.verified} verified
          </p>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-1">
          <p className="text-xs text-slate-500">Resolved & Closed</p>
          <p className="font-mono text-2xl sm:text-3xl font-bold text-emerald-800 tabular-nums">
            {liveStats.resolved}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {liveStats.rate}% monthly resolution rate
          </p>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-1">
          <p className="text-xs text-slate-500">Active Field Work</p>
          <p className="font-mono text-2xl sm:text-3xl font-bold text-amber-700 tabular-nums">
            {liveStats.inProgress}
          </p>
          <p className="text-xs text-slate-500">Dispatched to ward crews</p>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-1">
          <p className="text-xs text-slate-500">Sanctioned Works Value</p>
          <p className="font-mono text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
            {formatINR(liveStats.budget)}
          </p>
          <p className="text-xs text-slate-500">Publicly audited estimates</p>
        </div>
      </div>

      {/* Charts + Official Published Statement */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                Service Requests by Category
              </h2>
              <p className="text-xs text-slate-500">
                Total logged vs resolved tickets for {formatMonthLabel(selectedMonth)}
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              {selectedMonth}
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 11, fill: '#475569' }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#475569' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="Total" fill="#94A3B8" radius={[6, 6, 0, 0]} maxBarSize={32} />
                <Bar dataKey="Resolved" fill="#14532D" radius={[6, 6, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Official Published Summary Card */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 flex flex-col justify-between space-y-4">
          {activePublishedReport ? (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-emerald-800">Official Published Report</span>
                  <span className="font-mono tabular-nums">
                    Updated {formatTimestamp(activePublishedReport.updatedAt)}
                  </span>
                </div>
                <h2 className="font-display text-xl font-bold text-slate-900">
                  {activePublishedReport.monthLabel} Executive Summary
                </h2>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {activePublishedReport.summaryText}
                </p>
                {activePublishedReport.actionPlan && (
                  <div className="pt-3 border-t border-slate-200/80 space-y-1">
                    <p className="text-xs font-semibold text-slate-900">Next Month Action Plan</p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {activePublishedReport.actionPlan}
                    </p>
                  </div>
                )}
              </div>
              <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
                <span>Signed by {activePublishedReport.publishedByName}</span>
                <span className="font-mono tabular-nums">
                  Top Sector: {activePublishedReport.topCategory}
                </span>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8 space-y-2">
              <FileSpreadsheet className="w-8 h-8 text-slate-300" />
              <h2 className="font-display text-base font-bold text-slate-900">
                No published statement for {formatMonthLabel(selectedMonth)}
              </h2>
              <p className="text-xs text-slate-500 max-w-xs">
                {isAdminStaff
                  ? 'Use the Administrative Report Generator below to compile and publish this month’s official transparency report.'
                  : 'Administrative staff will publish the signed monthly statement once ward audits are finalized.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Ward-Wise Accountability Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200/80">
          <h2 className="font-display text-lg font-bold text-slate-900">
            Ward-Wise Service Breakdown
          </h2>
          <p className="text-xs text-slate-500">
            Transparent tracking of open vs resolved civic tickets across Shantinagar wards.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/70 text-xs font-semibold text-slate-600">
                <th className="py-3 px-5">Ward</th>
                <th className="py-3 px-4 text-right">Logged</th>
                <th className="py-3 px-4 text-right">Resolved</th>
                <th className="py-3 px-4 text-right">Pending / Active</th>
                <th className="py-3 px-5 text-right">Sanctioned Spend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 text-sm">
              {wardTableData.map((row) => (
                <tr key={row.ward} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-5 font-medium text-slate-900">{row.ward}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                    {row.total}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                    {row.resolved}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-700">
                    {row.open}
                  </td>
                  <td className="py-3 px-5 text-right font-mono tabular-nums text-slate-900">
                    {formatINR(row.budget)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Administrative Staff Monthly Report Publisher */}
      {isAdminStaff && (
        <form
          onSubmit={handlePublishReport}
          className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-4 no-print"
        >
          <div className="space-y-1">
            <p className="text-xs font-mono text-emerald-800">Administrative Staff Control</p>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Generate & Publish {formatMonthLabel(selectedMonth)} Status Report
            </h2>
            <p className="text-xs text-slate-600">
              Metrics ({liveStats.total} requests, {liveStats.resolved} resolved, {formatINR(liveStats.budget)}) are automatically computed from live Firestore service tickets and broadcast to all villagers on publish.
            </p>
          </div>

          {publishError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
              {publishError}
            </div>
          )}
          {publishFeedback && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
              <span>{publishFeedback}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="rep-summary" className="block text-xs font-semibold text-slate-700">
                Secretary Transparency Summary
              </label>
              <textarea
                id="rep-summary"
                rows={4}
                required
                minLength={SCHEMA_LIMITS.REPORT_SUMMARY_MIN}
                maxLength={SCHEMA_LIMITS.REPORT_SUMMARY_MAX}
                value={summaryText}
                onChange={(e) => setSummaryText(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="rep-action" className="block text-xs font-semibold text-slate-700">
                Upcoming Ward Action Plan
              </label>
              <textarea
                id="rep-action"
                rows={4}
                maxLength={SCHEMA_LIMITS.REPORT_ACTION_MAX}
                value={actionPlan}
                onChange={(e) => setActionPlan(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={publishing}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-900 text-white text-sm font-semibold hover:bg-emerald-800 transition-colors disabled:opacity-60"
            >
              {publishing
                ? 'Publishing Report...'
                : activePublishedReport
                  ? 'Update & Republish Official Report'
                  : 'Publish Official Monthly Report'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
