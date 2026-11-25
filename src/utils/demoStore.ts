import { Timestamp } from 'firebase/firestore';
import {
  formatMonthLabel,
  GENERATED_ASSETS,
  getCurrentMonthKey,
  type AccessRole,
  type IssueCategory,
  type IssuePriority,
  type IssueStatus,
  type MonthlyReport,
  type PortalNotification,
  type RoleLabel,
  type ServiceRequest,
  type ServiceUpdate,
  type UserPrivateContact,
  type UserProfile,
} from '../types';
import { roleToLabel } from './panchayatService';

const DATA_KEY = 'gramdev_project_data_v1';
const SESSION_KEY = 'gramdev_project_session_v1';

export interface DemoSessionUser {
  uid: string;
  displayName: string;
  identifier: string;
  email: string;
  phone: string;
  ward: string;
  address: string;
  preferredMode: AccessRole;
}

interface StoredRequest extends Omit<ServiceRequest, 'createdAt' | 'updatedAt'> {
  createdAtMs: number;
  updatedAtMs: number;
}

interface StoredUpdate extends Omit<ServiceUpdate, 'createdAt'> {
  createdAtMs: number;
}

interface StoredReport extends Omit<MonthlyReport, 'createdAt' | 'updatedAt'> {
  createdAtMs: number;
  updatedAtMs: number;
}

interface StoredNotification extends Omit<PortalNotification, 'createdAt'> {
  createdAtMs: number;
}

interface StoredUser extends Omit<UserProfile, 'createdAt' | 'updatedAt'> {
  createdAtMs: number;
  updatedAtMs: number;
}

interface StoredDemoDatabase {
  requests: StoredRequest[];
  updates: Record<string, StoredUpdate[]>;
  reports: StoredReport[];
  notifications: StoredNotification[];
  users: StoredUser[];
}

export interface HydratedDemoDatabase {
  requests: ServiceRequest[];
  updates: Record<string, ServiceUpdate[]>;
  reports: MonthlyReport[];
  notifications: PortalNotification[];
  users: UserProfile[];
}

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function makeTrackingCode(): string {
  const year = new Date().getFullYear();
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  return `GD-${year}-${suffix}`;
}

function createInitialDatabase(): StoredDemoDatabase {
  const now = Date.now();
  const hour = 3600 * 1000;
  const monthKey = getCurrentMonthKey();
  const monthLabel = formatMonthLabel(monthKey);

  const requests: StoredRequest[] = [
    {
      id: 'demo-water-01',
      trackingCode: 'GD-2026-1041',
      title: 'Leaking public drinking water standpipe near Old Well',
      description:
        'Main brass valve on the community drinking water standpipe has been leaking continuously since early morning, flooding the stone path used by school children.',
      category: 'Water Supply',
      ward: 'Ward 2 - Temple Street',
      landmark: 'Beside Lakshmi Temple Stone Lane',
      lat: 12.2948,
      lng: 76.6384,
      status: 'In Progress',
      priority: 'High',
      photoUrl: GENERATED_ASSETS.waterPipeline,
      resolutionPhotoUrl: '',
      reporterUid: 'demo-citizen-1',
      reporterName: 'Ramesh Gowda',
      assignedOfficerUid: 'demo-officer-1',
      assignedOfficerName: 'K. Manjunath (Water Technician)',
      officerNotes:
        'Replacement gate valve and elbow joint issued from Panchayat store. Plumbing crew scheduled today.',
      estimatedBudget: 4800,
      monthKey,
      visibility: 'public',
      createdAtMs: now - 36 * hour,
      updatedAtMs: now - 4 * hour,
    },
    {
      id: 'demo-road-02',
      trackingCode: 'GD-2026-1042',
      title: 'Crumbled asphalt shoulder and potholes along Paddy Field Link Road',
      description:
        'Monsoon runoff eroded the left shoulder of the link road connecting Ward 3 farms to the dairy collection booth. Two-wheelers and milk carts face difficulty.',
      category: 'Roads & Drainage',
      ward: 'Ward 3 - Tank Bund',
      landmark: '200m east of Milk Cooperative Booth',
      lat: 12.2923,
      lng: 76.6348,
      status: 'Verified',
      priority: 'Urgent',
      photoUrl: GENERATED_ASSETS.villageRoad,
      resolutionPhotoUrl: '',
      reporterUid: 'demo-citizen-2',
      reporterName: 'Lakshmi Devi',
      assignedOfficerUid: 'demo-officer-2',
      assignedOfficerName: 'S. Savitha (Junior Engineer)',
      officerNotes:
        'Site measured (42m stretch). Gravel compaction and wet-mix patch estimate submitted for sanction.',
      estimatedBudget: 38500,
      monthKey,
      visibility: 'public',
      createdAtMs: now - 60 * hour,
      updatedAtMs: now - 10 * hour,
    },
    {
      id: 'demo-light-03',
      trackingCode: 'GD-2026-1043',
      title: 'Solar LED streetlight battery controller replaced on North Lane',
      description:
        'Pole #14 solar streetlight stopped turning on after dusk, leaving the pedestrian crossing near the Anganwadi center dark.',
      category: 'Street Lighting',
      ward: 'Ward 4 - School Road',
      landmark: 'Opposite Government Primary School Gate',
      lat: 12.2993,
      lng: 76.6374,
      status: 'Resolved',
      priority: 'Medium',
      photoUrl: GENERATED_ASSETS.solarStreetlight,
      resolutionPhotoUrl: GENERATED_ASSETS.solarStreetlight,
      reporterUid: 'demo-citizen-1',
      reporterName: 'Ramesh Gowda',
      assignedOfficerUid: 'demo-officer-1',
      assignedOfficerName: 'R. Prakash (Electrical Assistant)',
      officerNotes:
        'Faulty LiFePO4 charge controller replaced and panel cleaned. Verified luminous output at 6:30 PM.',
      estimatedBudget: 6200,
      monthKey,
      visibility: 'public',
      createdAtMs: now - 96 * hour,
      updatedAtMs: now - 18 * hour,
    },
    {
      id: 'demo-sanit-04',
      trackingCode: 'GD-2026-1044',
      title: 'Weekly desilting required for stormwater drain near Agri Market',
      description:
        'Silt and dry leaves have accumulated near the culvert grating outside the Thursday vegetable market yard.',
      category: 'Sanitation',
      ward: 'Ward 5 - Agri Market',
      landmark: 'South Entrance of Weekly Shandy Yard',
      lat: 12.2937,
      lng: 76.6442,
      status: 'Submitted',
      priority: 'Low',
      photoUrl: '',
      resolutionPhotoUrl: '',
      reporterUid: 'demo-citizen-2',
      reporterName: 'Lakshmi Devi',
      assignedOfficerUid: '',
      assignedOfficerName: '',
      officerNotes: '',
      estimatedBudget: 0,
      monthKey,
      visibility: 'public',
      createdAtMs: now - 12 * hour,
      updatedAtMs: now - 12 * hour,
    },
  ];

  const updates: Record<string, StoredUpdate[]> = {
    'demo-water-01': [
      {
        id: 'upd-w2',
        requestId: 'demo-water-01',
        authorUid: 'demo-officer-1',
        authorName: 'K. Manjunath',
        authorRole: 'Authorized Officer',
        previousStatus: 'Verified',
        newStatus: 'In Progress',
        note: 'Replacement gate valve and elbow joint issued from Panchayat store. Plumbing crew dispatched.',
        visibility: 'public',
        createdAtMs: now - 4 * hour,
      },
      {
        id: 'upd-w1',
        requestId: 'demo-water-01',
        authorUid: 'demo-citizen-1',
        authorName: 'Ramesh Gowda',
        authorRole: 'Public Citizen',
        previousStatus: 'Submitted',
        newStatus: 'Submitted',
        note: 'Issue reported with site photograph beside Lakshmi Temple Stone Lane.',
        visibility: 'public',
        createdAtMs: now - 36 * hour,
      },
    ],
    'demo-road-02': [
      {
        id: 'upd-r2',
        requestId: 'demo-road-02',
        authorUid: 'demo-officer-2',
        authorName: 'S. Savitha',
        authorRole: 'Authorized Officer',
        previousStatus: 'Submitted',
        newStatus: 'Verified',
        note: 'Site measured (42m stretch). Gravel compaction and wet-mix patch estimate submitted.',
        visibility: 'public',
        createdAtMs: now - 10 * hour,
      },
    ],
    'demo-light-03': [
      {
        id: 'upd-l2',
        requestId: 'demo-light-03',
        authorUid: 'demo-officer-1',
        authorName: 'R. Prakash',
        authorRole: 'Authorized Officer',
        previousStatus: 'In Progress',
        newStatus: 'Resolved',
        note: 'Faulty LiFePO4 charge controller replaced and panel cleaned. Verified luminous output.',
        visibility: 'public',
        createdAtMs: now - 18 * hour,
      },
    ],
    'demo-sanit-04': [
      {
        id: 'upd-s1',
        requestId: 'demo-sanit-04',
        authorUid: 'demo-citizen-2',
        authorName: 'Lakshmi Devi',
        authorRole: 'Public Citizen',
        previousStatus: 'Submitted',
        newStatus: 'Submitted',
        note: 'Logged into GramDev civic register. Awaiting ward officer inspection.',
        visibility: 'public',
        createdAtMs: now - 12 * hour,
      },
    ],
  };

  const reports: StoredReport[] = [
    {
      id: monthKey,
      monthKey,
      monthLabel,
      totalRequests: 4,
      resolvedCount: 1,
      inProgressCount: 1,
      verifiedCount: 1,
      pendingCount: 1,
      resolutionRate: 25,
      totalSanctionedBudget: 49500,
      topCategory: 'Water Supply',
      summaryText:
        'Shantinagar Gram Panchayat reviewed 4 priority ward service tickets across water supply, farm link roads, solar street lighting, and market sanitation. Solar lighting on School Road is fully restored, water valve replacement is underway on Temple Street, and road patching sanction has been approved for Tank Bund.',
      actionPlan:
        'Complete Tank Bund road shoulder reinforcement before the next Gram Sabha review, and schedule bi-weekly stormwater drain clearing across Wards 1 through 6.',
      publishedByUid: 'demo-admin-1',
      publishedByName: 'Panchayat Secretary',
      isPublished: true,
      createdAtMs: now - 24 * hour,
      updatedAtMs: now - 5 * hour,
    },
  ];

  const notifications: StoredNotification[] = [
    {
      id: 'notif-welcome',
      recipientUid: 'all',
      senderUid: 'demo-admin-1',
      requestId: '',
      title: `Gram Sabha Transparency Update — ${monthLabel}`,
      message:
        'Villagers can upload site photos for local water, road, streetlight, and sanitation issues and follow real-time officer updates on GramDev.',
      type: 'public_notice',
      isRead: false,
      createdAtMs: now - 6 * hour,
    },
    {
      id: 'notif-water',
      recipientUid: 'all',
      senderUid: 'demo-officer-1',
      requestId: 'demo-water-01',
      title: 'GD-2026-1041 is now In Progress',
      message:
        'K. Manjunath (Authorized Officer): Replacement gate valve issued from Panchayat store; plumbing crew dispatched to Ward 2.',
      type: 'status_update',
      isRead: false,
      createdAtMs: now - 4 * hour,
    },
  ];

  const users: StoredUser[] = [
    {
      uid: 'demo-admin-1',
      displayName: 'Panchayat Secretary',
      ward: 'Ward 1 - East Layout',
      roleLabel: 'Administrative Staff',
      isDirectoryVisible: true,
      createdAtMs: now - 200 * hour,
      updatedAtMs: now - 20 * hour,
    },
    {
      uid: 'demo-officer-1',
      displayName: 'K. Manjunath',
      ward: 'Ward 2 - Temple Street',
      roleLabel: 'Authorized Officer',
      isDirectoryVisible: true,
      createdAtMs: now - 180 * hour,
      updatedAtMs: now - 20 * hour,
    },
    {
      uid: 'demo-officer-2',
      displayName: 'S. Savitha',
      ward: 'Ward 3 - Tank Bund',
      roleLabel: 'Authorized Officer',
      isDirectoryVisible: true,
      createdAtMs: now - 150 * hour,
      updatedAtMs: now - 20 * hour,
    },
    {
      uid: 'demo-citizen-1',
      displayName: 'Ramesh Gowda',
      ward: 'Ward 4 - School Road',
      roleLabel: 'Public Citizen',
      isDirectoryVisible: true,
      createdAtMs: now - 120 * hour,
      updatedAtMs: now - 20 * hour,
    },
  ];

  return { requests, updates, reports, notifications, users };
}

function readRaw(): StoredDemoDatabase {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (raw) {
      return JSON.parse(raw) as StoredDemoDatabase;
    }
  } catch {
    // fallback to seed
  }
  const initial = createInitialDatabase();
  writeRaw(initial);
  return initial;
}

function writeRaw(data: StoredDemoDatabase) {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  } catch {
    // ignore storage quota overflow
  }
  notifyListeners();
}

export function getDemoDatabase(): HydratedDemoDatabase {
  const raw = readRaw();
  return {
    requests: raw.requests
      .map((r) => ({
        ...r,
        createdAt: Timestamp.fromMillis(r.createdAtMs),
        updatedAt: Timestamp.fromMillis(r.updatedAtMs),
      }))
      .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)),
    updates: Object.fromEntries(
      Object.entries(raw.updates).map(([reqId, list]) => [
        reqId,
        list
          .map((u) => ({ ...u, createdAt: Timestamp.fromMillis(u.createdAtMs) }))
          .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)),
      ]),
    ),
    reports: raw.reports
      .map((rep) => ({
        ...rep,
        createdAt: Timestamp.fromMillis(rep.createdAtMs),
        updatedAt: Timestamp.fromMillis(rep.updatedAtMs),
      }))
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey)),
    notifications: raw.notifications
      .map((n) => ({ ...n, createdAt: Timestamp.fromMillis(n.createdAtMs) }))
      .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)),
    users: raw.users
      .map((u) => ({
        ...u,
        createdAt: Timestamp.fromMillis(u.createdAtMs),
        updatedAt: Timestamp.fromMillis(u.updatedAtMs),
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName)),
  };
}

export function subscribeDemoDatabase(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function loadDemoSession(): DemoSessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DemoSessionUser;
  } catch {
    return null;
  }
}

export function saveDemoSession(session: DemoSessionUser): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  const db = readRaw();
  const exists = db.users.some((u) => u.uid === session.uid);
  const now = Date.now();
  if (!exists) {
    db.users.push({
      uid: session.uid,
      displayName: session.displayName,
      ward: session.ward,
      roleLabel: roleToLabel(session.preferredMode),
      isDirectoryVisible: true,
      createdAtMs: now,
      updatedAtMs: now,
    });
    writeRaw(db);
  }
}

export function clearDemoSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function getDemoUserProfile(session: DemoSessionUser): {
  profile: UserProfile;
  contact: UserPrivateContact;
} {
  const db = readRaw();
  const found = db.users.find((u) => u.uid === session.uid);
  const now = Timestamp.now();
  const profile: UserProfile = found
    ? {
        ...found,
        createdAt: Timestamp.fromMillis(found.createdAtMs),
        updatedAt: Timestamp.fromMillis(found.updatedAtMs),
      }
    : {
        uid: session.uid,
        displayName: session.displayName,
        ward: session.ward,
        roleLabel: roleToLabel(session.preferredMode),
        isDirectoryVisible: true,
        createdAt: now,
        updatedAt: now,
      };
  const contact: UserPrivateContact = {
    uid: session.uid,
    email: session.email,
    phone: session.phone,
    address: session.address,
    updatedAt: now,
  };
  return { profile, contact };
}

export function demoCreateServiceRequest(input: {
  title: string;
  description: string;
  category: IssueCategory;
  ward: string;
  landmark: string;
  lat?: number;
  lng?: number;
  priority: IssuePriority;
  photoUrl: string;
  reporterUid: string;
  reporterName: string;
}): string {
  const db = readRaw();
  const now = Date.now();
  const id = makeId('req');
  const trackingCode = makeTrackingCode();
  const monthKey = getCurrentMonthKey();

  db.requests.unshift({
    id,
    trackingCode,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    ward: input.ward,
    landmark: input.landmark.trim(),
    ...(typeof input.lat === 'number' && typeof input.lng === 'number'
      ? { lat: input.lat, lng: input.lng }
      : {}),
    status: 'Submitted',
    priority: input.priority,
    photoUrl: input.photoUrl,
    resolutionPhotoUrl: '',
    reporterUid: input.reporterUid,
    reporterName: input.reporterName.trim() || 'Village Resident',
    assignedOfficerUid: '',
    assignedOfficerName: '',
    officerNotes: '',
    estimatedBudget: 0,
    monthKey,
    visibility: 'public',
    createdAtMs: now,
    updatedAtMs: now,
  });

  db.updates[id] = [
    {
      id: makeId('upd'),
      requestId: id,
      authorUid: input.reporterUid,
      authorName: input.reporterName.trim() || 'Village Resident',
      authorRole: 'Public Citizen',
      previousStatus: 'Submitted',
      newStatus: 'Submitted',
      note: `Issue reported at ${input.landmark.trim()} (${input.ward}). Awaiting ward officer verification.`,
      visibility: 'public',
      createdAtMs: now,
    },
  ];

  db.notifications.unshift({
    id: makeId('ntf'),
    recipientUid: input.reporterUid,
    senderUid: input.reporterUid,
    requestId: id,
    title: `Registered: ${trackingCode}`,
    message: `Your report "${input.title.trim()}" has been logged for ${input.ward}. You will receive real-time alerts on every update.`,
    type: 'status_update',
    isRead: false,
    createdAtMs: now,
  });

  writeRaw(db);
  return id;
}

export function demoUpdateRequestProgress(input: {
  request: ServiceRequest;
  newStatus: IssueStatus;
  priority: IssuePriority;
  assignedOfficerUid: string;
  assignedOfficerName: string;
  officerNotes: string;
  estimatedBudget: number;
  resolutionPhotoUrl: string;
  actorUid: string;
  actorName: string;
  actorRoleLabel: RoleLabel;
}): void {
  const db = readRaw();
  const now = Date.now();
  const idx = db.requests.findIndex((r) => r.id === input.request.id);
  if (idx === -1) return;

  const existing = db.requests[idx];
  const noteText =
    input.officerNotes.trim() ||
    `Status updated from ${existing.status} to ${input.newStatus}.`;

  db.requests[idx] = {
    ...existing,
    status: input.newStatus,
    priority: input.priority,
    assignedOfficerUid: input.assignedOfficerUid,
    assignedOfficerName: input.assignedOfficerName.trim(),
    officerNotes: input.officerNotes.trim(),
    estimatedBudget: Math.max(0, Math.round(input.estimatedBudget || 0)),
    resolutionPhotoUrl: input.resolutionPhotoUrl,
    updatedAtMs: now,
  };

  if (!db.updates[existing.id]) db.updates[existing.id] = [];
  db.updates[existing.id].unshift({
    id: makeId('upd'),
    requestId: existing.id,
    authorUid: input.actorUid,
    authorName: input.actorName,
    authorRole: input.actorRoleLabel,
    previousStatus: existing.status,
    newStatus: input.newStatus,
    note: noteText,
    visibility: 'public',
    createdAtMs: now,
  });

  db.notifications.unshift({
    id: makeId('ntf'),
    recipientUid: existing.reporterUid,
    senderUid: input.actorUid,
    requestId: existing.id,
    title: `${existing.trackingCode} is now ${input.newStatus}`,
    message: `${input.actorName} (${input.actorRoleLabel}): ${noteText}`,
    type: 'status_update',
    isRead: false,
    createdAtMs: now,
  });

  writeRaw(db);
}

export function demoDeleteRequest(requestId: string): void {
  const db = readRaw();
  db.requests = db.requests.filter((r) => r.id !== requestId);
  delete db.updates[requestId];
  writeRaw(db);
}

export function demoPublishMonthlyReport(params: {
  monthKey: string;
  requests: ServiceRequest[];
  summaryText: string;
  actionPlan: string;
  actorUid: string;
  actorName: string;
}): void {
  const db = readRaw();
  const now = Date.now();
  const monthReqs = params.requests.filter((r) => r.monthKey === params.monthKey);
  const totalRequests = monthReqs.length;
  const resolvedCount = monthReqs.filter(
    (r) => r.status === 'Resolved' || r.status === 'Closed',
  ).length;
  const inProgressCount = monthReqs.filter((r) => r.status === 'In Progress').length;
  const verifiedCount = monthReqs.filter((r) => r.status === 'Verified').length;
  const pendingCount = monthReqs.filter((r) => r.status === 'Submitted').length;
  const resolutionRate =
    totalRequests > 0 ? Math.round((resolvedCount / totalRequests) * 100) : 0;
  const totalSanctionedBudget = monthReqs.reduce(
    (sum, r) => sum + (Number(r.estimatedBudget) || 0),
    0,
  );

  const counts = new Map<string, number>();
  for (const r of monthReqs) counts.set(r.category, (counts.get(r.category) || 0) + 1);
  let topCategory = 'General Civic Works';
  let best = 0;
  for (const [cat, c] of counts.entries()) {
    if (c > best) {
      best = c;
      topCategory = cat;
    }
  }

  const monthLabel = formatMonthLabel(params.monthKey);
  const existingIdx = db.reports.findIndex((r) => r.monthKey === params.monthKey);
  const entry: StoredReport = {
    id: params.monthKey,
    monthKey: params.monthKey,
    monthLabel,
    totalRequests,
    resolvedCount,
    inProgressCount,
    verifiedCount,
    pendingCount,
    resolutionRate,
    totalSanctionedBudget,
    topCategory,
    summaryText: params.summaryText.trim(),
    actionPlan: params.actionPlan.trim(),
    publishedByUid: params.actorUid,
    publishedByName: params.actorName,
    isPublished: true,
    createdAtMs: existingIdx >= 0 ? db.reports[existingIdx].createdAtMs : now,
    updatedAtMs: now,
  };

  if (existingIdx >= 0) {
    db.reports[existingIdx] = entry;
  } else {
    db.reports.unshift(entry);
  }

  db.notifications.unshift({
    id: makeId('ntf'),
    recipientUid: 'all',
    senderUid: params.actorUid,
    requestId: '',
    title: `Monthly Transparency Report: ${monthLabel}`,
    message: `${monthLabel} status report published (${resolvedCount}/${totalRequests} resolved, ${resolutionRate}% completion).`,
    type: 'report_published',
    isRead: false,
    createdAtMs: now,
  });

  writeRaw(db);
}

export function demoMarkNotificationRead(notificationId: string): void {
  const db = readRaw();
  const idx = db.notifications.findIndex((n) => n.id === notificationId);
  if (idx >= 0) {
    db.notifications[idx].isRead = true;
    writeRaw(db);
  }
}

export function demoBroadcastNotice(params: {
  title: string;
  message: string;
  actorUid: string;
}): void {
  const db = readRaw();
  db.notifications.unshift({
    id: makeId('ntf'),
    recipientUid: 'all',
    senderUid: params.actorUid,
    requestId: '',
    title: params.title.trim(),
    message: params.message.trim(),
    type: 'public_notice',
    isRead: false,
    createdAtMs: Date.now(),
  });
  writeRaw(db);
}

export function demoUpdateMemberRole(targetUid: string, newRole: AccessRole): void {
  const db = readRaw();
  const idx = db.users.findIndex((u) => u.uid === targetUid);
  if (idx >= 0) {
    db.users[idx].roleLabel = roleToLabel(newRole);
    db.users[idx].updatedAtMs = Date.now();
    writeRaw(db);
  }
}

export function demoUpdateOwnProfile(
  session: DemoSessionUser,
  updates: { displayName: string; ward: string; phone: string; address: string },
): DemoSessionUser {
  const next: DemoSessionUser = {
    ...session,
    displayName: updates.displayName.trim(),
    ward: updates.ward,
    phone: updates.phone.trim(),
    address: updates.address.trim(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(next));

  const db = readRaw();
  const idx = db.users.findIndex((u) => u.uid === session.uid);
  if (idx >= 0) {
    db.users[idx].displayName = next.displayName;
    db.users[idx].ward = next.ward;
    db.users[idx].updatedAtMs = Date.now();
    writeRaw(db);
  }
  return next;
}

export function demoResetSampleData(): void {
  writeRaw(createInitialDatabase());
}
