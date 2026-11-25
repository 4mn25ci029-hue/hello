import { useCallback, useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  sendEmailVerification,
  signOut,
  type User,
} from 'firebase/auth';
import {
  Bell,
  Camera,
  FileBarChart2,
  LayoutGrid,
  Loader2,
  MailCheck,
  Map as MapIcon,
  UserCircle2,
  X,
} from 'lucide-react';
import { auth } from './firebase';
import {
  type AccessRole,
  type MonthlyReport,
  type PortalNotification,
  type ServiceRequest,
  type ServiceUpdate,
  type UserPrivateContact,
  type UserProfile,
} from './types';
import {
  clearDemoSession,
  demoResetSampleData,
  getDemoDatabase,
  getDemoUserProfile,
  loadDemoSession,
  saveDemoSession,
  subscribeDemoDatabase,
  type DemoSessionUser,
} from './utils/demoStore';
import {
  ensureUserProfile,
  resolveUserAccessRole,
  roleToLabel,
  seedInitialPanchayatData,
  subscribeDirectoryUsers,
  subscribeMonthlyReports,
  subscribeNotifications,
  subscribeServiceRequests,
} from './utils/panchayatService';
import { AuthScreen } from './components/AuthScreen';
import { DashboardView } from './components/DashboardView';
import { ReportIssueSheet } from './components/ReportIssueSheet';
import { RequestDetailSheet } from './components/RequestDetailSheet';
import { MonthlyReportsView } from './components/MonthlyReportsView';
import { NotificationsView } from './components/NotificationsView';
import { AdminStaffPanel } from './components/AdminStaffPanel';
import { VillageMapView } from './components/VillageMapView';

type NavTab = 'dashboard' | 'map' | 'reports' | 'notifications' | 'account';

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [demoSession, setDemoSession] = useState<DemoSessionUser | null>(() => loadDemoSession());

  const [actualRole, setActualRole] = useState<AccessRole>('public');
  const [activeMode, setActiveMode] = useState<AccessRole>('public');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [contact, setContact] = useState<UserPrivateContact | null>(null);

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [demoUpdatesMap, setDemoUpdatesMap] = useState<Record<string, ServiceUpdate[]>>({});
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [directoryUsers, setDirectoryUsers] = useState<UserProfile[]>([]);

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [verifyingCheck, setVerifyingCheck] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [liveToast, setLiveToast] = useState<PortalNotification | null>(null);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  const preferredGoogleModeRef = useRef<AccessRole | null>(null);
  const seenNotifIdsRef = useRef<Set<string>>(new Set());
  const notifInitializedRef = useRef(false);

  const isDemoMode = Boolean(demoSession && !firebaseUser);

  const hydrateFirebaseSession = useCallback(async (user: User) => {
    const resolvedRole = await resolveUserAccessRole(user);
    setActualRole(resolvedRole);
    const chosen = preferredGoogleModeRef.current;
    preferredGoogleModeRef.current = null;

    setActiveMode(() => {
      if (resolvedRole === 'admin') return chosen ?? 'public';
      if (resolvedRole === 'authorized') {
        return chosen === 'authorized' ? 'authorized' : 'public';
      }
      return 'public';
    });

    const { profile: userProfile, contact: userContact } = await ensureUserProfile(
      user,
      resolvedRole,
    );
    setProfile(userProfile);
    setContact(userContact);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        clearDemoSession();
        setDemoSession(null);
        try {
          await hydrateFirebaseSession(user);
        } catch (err) {
          console.error('Session hydration error:', err);
        }
      } else if (!loadDemoSession()) {
        setActualRole('public');
        setActiveMode('public');
        setProfile(null);
        setContact(null);
        setRequests([]);
        setReports([]);
        setNotifications([]);
        setDirectoryUsers([]);
        notifInitializedRef.current = false;
        seenNotifIdsRef.current.clear();
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, [hydrateFirebaseSession]);

  // Project Demo Session subscription (general number/email + password)
  useEffect(() => {
    if (!demoSession || firebaseUser) return;

    // Allow exploring all 3 modes freely in project demo mode
    setActualRole('admin');
    setActiveMode(demoSession.preferredMode || 'public');

    const syncDemo = () => {
      const db = getDemoDatabase();
      const { profile: demoProf, contact: demoCont } = getDemoUserProfile(demoSession);
      setProfile(demoProf);
      setContact(demoCont);
      setRequests(db.requests);
      setDemoUpdatesMap(db.updates);
      setReports(db.reports);
      setDirectoryUsers(db.users);
      setRequestsLoading(false);

      const relevantNotifs = db.notifications.filter(
        (n) => n.recipientUid === demoSession.uid || n.recipientUid === 'all',
      );
      if (!notifInitializedRef.current) {
        relevantNotifs.forEach((n) => seenNotifIdsRef.current.add(n.id));
        notifInitializedRef.current = true;
      } else {
        const newest = relevantNotifs.find((n) => !seenNotifIdsRef.current.has(n.id));
        relevantNotifs.forEach((n) => seenNotifIdsRef.current.add(n.id));
        if (newest) setLiveToast(newest);
      }
      setNotifications(relevantNotifs);
    };

    syncDemo();
    const unsub = subscribeDemoDatabase(syncDemo);
    return () => unsub();
  }, [demoSession, firebaseUser]);

  // Attach real-time Firestore listeners only when authenticated via Firebase
  useEffect(() => {
    if (!authReady || !firebaseUser) return;
    setRequestsLoading(true);

    const unsubReqs = subscribeServiceRequests((items) => {
      setRequests(items);
      setRequestsLoading(false);
    });

    const unsubReports = subscribeMonthlyReports((items) => {
      setReports(items);
    });

    const unsubNotifs = subscribeNotifications(firebaseUser.uid, (items) => {
      if (!notifInitializedRef.current) {
        items.forEach((n) => seenNotifIdsRef.current.add(n.id));
        notifInitializedRef.current = true;
      } else {
        const newest = items.find((n) => !seenNotifIdsRef.current.has(n.id));
        items.forEach((n) => seenNotifIdsRef.current.add(n.id));
        if (newest) {
          setLiveToast(newest);
        }
      }
      setNotifications(items);
    });

    const unsubUsers = subscribeDirectoryUsers((items) => {
      setDirectoryUsers(items);
    });

    return () => {
      unsubReqs();
      unsubReports();
      unsubNotifs();
      unsubUsers();
    };
  }, [authReady, firebaseUser]);

  // Auto-dismiss live notification toast after 6 seconds
  useEffect(() => {
    if (!liveToast) return;
    const timer = window.setTimeout(() => setLiveToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [liveToast]);

  // Listen for Google Maps Platform Demo Key quota / auth events
  useEffect(() => {
    const handleQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  const handleProjectLogin = (session: DemoSessionUser) => {
    notifInitializedRef.current = false;
    seenNotifIdsRef.current.clear();
    saveDemoSession(session);
    setDemoSession(session);
  };

  const handleRefreshVerification = async () => {
    if (!firebaseUser) return;
    setVerifyingCheck(true);
    setResendMessage(null);
    try {
      await firebaseUser.reload();
      const refreshed = auth.currentUser;
      if (refreshed) {
        setFirebaseUser(refreshed);
        if (refreshed.emailVerified) {
          await hydrateFirebaseSession(refreshed);
        } else {
          setResendMessage(
            'Email is still not verified. Please click the verification link in your inbox.',
          );
        }
      }
    } finally {
      setVerifyingCheck(false);
    }
  };

  const handleResendVerification = async () => {
    if (!firebaseUser) return;
    setResendMessage(null);
    try {
      await sendEmailVerification(firebaseUser);
      setResendMessage('Verification email sent. Check your inbox and spam folder.');
    } catch (err) {
      setResendMessage(err instanceof Error ? err.message : 'Could not resend verification email.');
    }
  };

  const handleSignOut = async () => {
    if (firebaseUser) {
      await signOut(auth);
    }
    clearDemoSession();
    setDemoSession(null);
    setActiveTab('dashboard');
    notifInitializedRef.current = false;
    seenNotifIdsRef.current.clear();
  };

  const handleSeedSample = async () => {
    setSeeding(true);
    try {
      if (isDemoMode) {
        demoResetSampleData();
      } else if (firebaseUser && actualRole === 'admin') {
        await seedInitialPanchayatData(
          firebaseUser.uid,
          profile?.displayName || firebaseUser.displayName || 'Panchayat Secretary',
        );
      }
    } finally {
      setSeeding(false);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F6F8F6] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600 text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-900" />
          <span>Connecting to GramDev Civic Portal...</span>
        </div>
      </div>
    );
  }

  if (!firebaseUser && !demoSession) {
    return (
      <AuthScreen
        onProjectLogin={handleProjectLogin}
        onGoogleSuccess={(preferredMode) => {
          preferredGoogleModeRef.current = preferredMode;
        }}
      />
    );
  }

  const currentUid = firebaseUser?.uid || demoSession?.uid || 'gramdev-user';
  const currentEmail = firebaseUser?.email || demoSession?.email || '';
  const emailVerified = isDemoMode ? true : Boolean(firebaseUser?.emailVerified);

  const unreadCount = notifications.filter(
    (n) => n.recipientUid === currentUid && !n.isRead,
  ).length;
  const selectedRequest = requests.find((r) => r.id === selectedRequestId) || null;
  const actorName =
    profile?.displayName ||
    demoSession?.displayName ||
    firebaseUser?.displayName ||
    'Village Resident';

  const availableModes: Array<{ id: AccessRole; label: string }> =
    actualRole === 'admin'
      ? [
          { id: 'public', label: 'Public Mode' },
          { id: 'authorized', label: 'Authorized Officer' },
          { id: 'admin', label: 'Administrative Staff' },
        ]
      : actualRole === 'authorized'
        ? [
            { id: 'public', label: 'Public Mode' },
            { id: 'authorized', label: 'Authorized Officer' },
          ]
        : [{ id: 'public', label: 'Public Mode' }];

  return (
    <div className="min-h-screen bg-[#F6F8F6] flex flex-col pb-20 md:pb-10">
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm no-print">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Top Bar Contract: strictly 3 zones separated by gap-8; compact 52px on mobile */}
      <header className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[52px] md:h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="font-display text-lg md:text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            GramDev
          </button>

          {/* Zone 2: 5 clean single-line text nav links (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            {(
              [
                { id: 'dashboard', label: 'Dashboard' },
                { id: 'map', label: 'Village Map' },
                { id: 'reports', label: 'Monthly Reports' },
                {
                  id: 'notifications',
                  label: unreadCount > 0 ? `Notices (${unreadCount})` : 'Notices',
                },
                { id: 'account', label: activeMode === 'admin' ? 'Staff & Roles' : 'Account' },
              ] as const
            ).map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-emerald-900 text-slate-950 font-semibold'
                      : 'border-transparent hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setReportModalOpen(true)}
              className="min-h-[38px] md:min-h-[40px] px-3.5 md:px-4 py-2 rounded-lg bg-emerald-900 text-white text-xs md:text-sm font-semibold hover:bg-emerald-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Camera className="w-4 h-4" />
              <span>Report Issue</span>
            </button>
          </div>
        </div>
      </header>

      {/* Workspace Mode Switcher Toolbar (Outside Top Bar!) */}
      <div className="w-full border-b border-slate-200/70 bg-white no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-900">{actorName}</span>
            <span aria-hidden="true">·</span>
            <span>{profile?.ward || demoSession?.ward || 'Ward 1 - East Layout'}</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-800 font-medium">{roleToLabel(activeMode)}</span>
          </div>

          {availableModes.length > 1 && (
            <div
              className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start sm:self-auto"
              role="group"
              aria-label="Switch portal mode"
            >
              {availableModes.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setActiveMode(m.id);
                    if (demoSession) {
                      const updated = { ...demoSession, preferredMode: m.id };
                      saveDemoSession(updated);
                      setDemoSession(updated);
                    }
                  }}
                  className={`min-h-[34px] px-3 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    activeMode === m.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Email Verification Prompt for unverified Firebase accounts */}
      {!isDemoMode && firebaseUser && !firebaseUser.emailVerified && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-5 no-print">
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <MailCheck className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-amber-950">
                  Verify your email to submit service requests
                </p>
                <p className="text-xs text-amber-900">
                  Click the link sent to{' '}
                  <span className="font-mono">{firebaseUser.email}</span> to enable live cloud submissions.
                </p>
                {resendMessage && (
                  <p className="text-xs font-medium text-amber-950 pt-1">{resendMessage}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleResendVerification}
                className="min-h-[40px] px-3.5 py-2 rounded-xl border border-amber-300 bg-white text-xs font-semibold text-amber-950 hover:bg-amber-100/50 whitespace-nowrap"
              >
                Resend Link
              </button>
              <button
                type="button"
                disabled={verifyingCheck}
                onClick={handleRefreshVerification}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-amber-900 text-white text-xs font-semibold hover:bg-amber-800 whitespace-nowrap disabled:opacity-60"
              >
                {verifyingCheck ? 'Checking...' : 'I Verified'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Notification Toast */}
      {liveToast && (
        <div className="fixed top-16 right-4 z-40 max-w-sm w-[calc(100%-2rem)] bg-slate-900 text-white rounded-2xl p-4 shadow-lg border border-slate-700 flex items-start justify-between gap-3 no-print">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-mono text-emerald-300">Live Progress Update</p>
            <p className="text-sm font-semibold leading-snug">{liveToast.title}</p>
            <p className="text-xs text-slate-300 line-clamp-2">{liveToast.message}</p>
            {liveToast.requestId && (
              <button
                type="button"
                onClick={() => {
                  setSelectedRequestId(liveToast.requestId);
                  setLiveToast(null);
                }}
                className="mt-1 text-xs font-semibold text-emerald-300 hover:underline"
              >
                Inspect Ticket
              </button>
            )}
          </div>
          <button
            type="button"
            aria-label="Dismiss alert"
            onClick={() => setLiveToast(null)}
            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'dashboard' && (
          <DashboardView
            requests={requests}
            loading={requestsLoading}
            activeMode={activeMode}
            actualRole={actualRole}
            currentUserUid={currentUid}
            onOpenReportModal={() => setReportModalOpen(true)}
            onSelectRequest={(req) => setSelectedRequestId(req.id)}
            onSeedSampleData={handleSeedSample}
            seeding={seeding}
          />
        )}

        {activeTab === 'map' && (
          <VillageMapView
            requests={requests}
            onSelectRequest={(req) => setSelectedRequestId(req.id)}
          />
        )}

        {activeTab === 'reports' && (
          <MonthlyReportsView
            requests={requests}
            reports={reports}
            activeMode={activeMode}
            actualRole={actualRole}
            actorUid={currentUid}
            actorName={actorName}
            isDemoMode={isDemoMode}
          />
        )}

        {activeTab === 'notifications' && (
          <NotificationsView
            notifications={notifications}
            userUid={currentUid}
            activeMode={activeMode}
            actualRole={actualRole}
            isDemoMode={isDemoMode}
            onOpenRequest={(reqId) => {
              setSelectedRequestId(reqId);
            }}
          />
        )}

        {activeTab === 'account' && (
          <AdminStaffPanel
            currentUserUid={currentUid}
            currentUserEmail={currentEmail}
            profile={profile}
            contact={contact}
            directoryUsers={directoryUsers}
            activeMode={activeMode}
            actualRole={actualRole}
            requestCount={requests.length}
            isDemoMode={isDemoMode}
            demoSession={demoSession}
            onDemoSessionChange={(next) => setDemoSession(next)}
            onSignOut={handleSignOut}
            onProfileUpdated={() => {
              if (firebaseUser) void hydrateFirebaseSession(firebaseUser);
            }}
          />
        )}
      </main>

      {/* Fixed Mobile Bottom Tab Bar (< md) — thumb-zone ergonomics, 56px height */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe no-print"
      >
        <div className="grid grid-cols-5 h-14 items-center">
          {(
            [
              { id: 'dashboard', label: 'Home', icon: LayoutGrid },
              { id: 'map', label: 'Map', icon: MapIcon },
              { id: 'reports', label: 'Reports', icon: FileBarChart2 },
              { id: 'notifications', label: 'Notices', icon: Bell },
              { id: 'account', label: 'Account', icon: UserCircle2 },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active ? 'text-emerald-900 font-semibold' : 'text-slate-500'
                }`}
              >
                <span className="relative flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                  {tab.id === 'notifications' && unreadCount > 0 && (
                    <span className="ml-1 text-[10px] font-mono font-bold text-emerald-800">
                      {unreadCount}
                    </span>
                  )}
                </span>
                <span className="text-[11px] leading-none">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Bottom Sheet / Modal: Villager Issue Reporting with Camera/Gallery Upload */}
      <ReportIssueSheet
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        reporterUid={currentUid}
        reporterName={actorName}
        defaultWard={profile?.ward || demoSession?.ward || 'Ward 1 - East Layout'}
        emailVerified={emailVerified}
        isDemoMode={isDemoMode}
        onCreated={(reqId) => {
          setActiveTab('dashboard');
          setSelectedRequestId(reqId);
        }}
      />

      {/* Bottom Sheet / Modal: Service Request Details + Officer/Admin Actions */}
      <RequestDetailSheet
        request={selectedRequest}
        onClose={() => setSelectedRequestId(null)}
        activeMode={activeMode}
        actualRole={actualRole}
        actorUid={currentUid}
        actorName={actorName}
        actorRoleLabel={roleToLabel(activeMode)}
        isDemoMode={isDemoMode}
        demoUpdates={selectedRequest ? demoUpdatesMap[selectedRequest.id] || [] : []}
        onDeleted={() => setSelectedRequestId(null)}
      />
    </div>
  );
}
