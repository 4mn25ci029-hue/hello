import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  formatMonthLabel,
  GENERATED_ASSETS,
  getCurrentMonthKey,
  SCHEMA_LIMITS,
  type AccessRole,
  type IssueCategory,
  type IssuePriority,
  type IssueStatus,
  type MonthlyReport,
  type NotificationType,
  type PortalNotification,
  type RoleLabel,
  type ServiceRequest,
  type ServiceUpdate,
  type UserPrivateContact,
  type UserProfile,
} from '../types';

function clampString(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

function generateId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

function generateTrackingCode(): string {
  const year = new Date().getFullYear();
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  return `GP-${year}-${suffix}`;
}

export function roleToLabel(role: AccessRole): RoleLabel {
  if (role === 'admin') return 'Administrative Staff';
  if (role === 'authorized') return 'Authorized Officer';
  return 'Public Citizen';
}

export async function resolveUserAccessRole(user: User): Promise<AccessRole> {
  if (
    user.emailVerified &&
    user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
  ) {
    return 'admin';
  }

  try {
    const adminSnap = await getDoc(doc(db, 'admins', user.uid));
    if (adminSnap.exists()) {
      return 'admin';
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `admins/${user.uid}`);
  }

  try {
    const authSnap = await getDoc(doc(db, 'authorizedStaff', user.uid));
    if (authSnap.exists()) {
      return 'authorized';
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `authorizedStaff/${user.uid}`);
  }

  return 'public';
}

export async function ensureUserProfile(
  user: User,
  accessRole: AccessRole,
  options?: { displayName?: string; ward?: string; phone?: string; address?: string },
): Promise<{ profile: UserProfile | null; contact: UserPrivateContact | null }> {
  const profilePath = `users/${user.uid}`;
  const contactPath = `users/${user.uid}/private/contact`;

  let existingProfile: UserProfile | null = null;
  let existingContact: UserPrivateContact | null = null;

  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      existingProfile = snap.data() as UserProfile;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, profilePath);
  }

  try {
    const contactSnap = await getDoc(doc(db, 'users', user.uid, 'private', 'contact'));
    if (contactSnap.exists()) {
      existingContact = contactSnap.data() as UserPrivateContact;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, contactPath);
  }

  if (!user.emailVerified) {
    return { profile: existingProfile, contact: existingContact };
  }

  const safeName = clampString(
    options?.displayName ||
      existingProfile?.displayName ||
      user.displayName ||
      user.email?.split('@')[0] ||
      'Village Resident',
    SCHEMA_LIMITS.DISPLAY_NAME_MAX,
  );
  const finalName = safeName.length >= 2 ? safeName : 'Village Resident';
  const safeWard = clampString(
    options?.ward || existingProfile?.ward || 'Ward 1 - East Layout',
    SCHEMA_LIMITS.WARD_MAX,
  );

  if (!existingProfile) {
    const initialRoleLabel: RoleLabel =
      accessRole === 'admin' ? 'Administrative Staff' : 'Public Citizen';
    const payload = {
      uid: user.uid,
      displayName: finalName,
      ward: safeWard,
      roleLabel: initialRoleLabel,
      isDirectoryVisible: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(doc(db, 'users', user.uid), payload);
      const freshSnap = await getDoc(doc(db, 'users', user.uid));
      existingProfile = freshSnap.exists() ? (freshSnap.data() as UserProfile) : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, profilePath);
    }
  } else if (accessRole === 'admin' && existingProfile.roleLabel !== 'Administrative Staff') {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        roleLabel: 'Administrative Staff',
        updatedAt: serverTimestamp(),
      });
      existingProfile = { ...existingProfile, roleLabel: 'Administrative Staff' };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, profilePath);
    }
  }

  if (!existingContact) {
    const contactPayload = {
      uid: user.uid,
      email: clampString(user.email || '', SCHEMA_LIMITS.EMAIL_MAX),
      phone: clampString(options?.phone || '', SCHEMA_LIMITS.PHONE_MAX),
      address: clampString(options?.address || safeWard, SCHEMA_LIMITS.ADDRESS_MAX),
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(doc(db, 'users', user.uid, 'private', 'contact'), contactPayload);
      const freshContact = await getDoc(doc(db, 'users', user.uid, 'private', 'contact'));
      existingContact = freshContact.exists() ? (freshContact.data() as UserPrivateContact) : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, contactPath);
    }
  }

  return { profile: existingProfile, contact: existingContact };
}

export async function updateOwnProfile(
  uid: string,
  updates: { displayName: string; ward: string; phone: string; address: string; email: string },
): Promise<void> {
  const safeName = clampString(updates.displayName, SCHEMA_LIMITS.DISPLAY_NAME_MAX);
  if (safeName.length < SCHEMA_LIMITS.DISPLAY_NAME_MIN) {
    throw new Error('Full name must be at least 2 characters.');
  }
  const safeWard = clampString(updates.ward, SCHEMA_LIMITS.WARD_MAX);

  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName: safeName,
      ward: safeWard,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }

  try {
    await updateDoc(doc(db, 'users', uid, 'private', 'contact'), {
      email: clampString(updates.email, SCHEMA_LIMITS.EMAIL_MAX),
      phone: clampString(updates.phone, SCHEMA_LIMITS.PHONE_MAX),
      address: clampString(updates.address, SCHEMA_LIMITS.ADDRESS_MAX),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}/private/contact`);
  }
}

export function subscribeDirectoryUsers(
  onData: (users: UserProfile[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'users'), where('isDirectoryVisible', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => d.data() as UserProfile)
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    },
  );
}

export function subscribeServiceRequests(
  onData: (requests: ServiceRequest[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'serviceRequests'), where('visibility', '==', 'public'));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<ServiceRequest, 'id'>) }))
        .sort((a, b) => {
          const at = a.createdAt?.toMillis() ?? Date.now();
          const bt = b.createdAt?.toMillis() ?? Date.now();
          return bt - at;
        });
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'serviceRequests');
    },
  );
}

export function subscribeRequestUpdates(
  requestId: string,
  onData: (updates: ServiceUpdate[]) => void,
): Unsubscribe {
  const path = `serviceRequests/${requestId}/updates`;
  const q = query(
    collection(db, 'serviceRequests', requestId, 'updates'),
    where('requestId', '==', requestId),
    where('visibility', '==', 'public'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<ServiceUpdate, 'id'>) }))
        .sort((a, b) => {
          const at = a.createdAt?.toMillis() ?? 0;
          const bt = b.createdAt?.toMillis() ?? 0;
          return bt - at;
        });
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}

export interface CreateServiceRequestInput {
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
}

export async function createServiceRequest(input: CreateServiceRequestInput): Promise<string> {
  const title = clampString(input.title, SCHEMA_LIMITS.TITLE_MAX);
  const description = clampString(input.description, SCHEMA_LIMITS.DESCRIPTION_MAX);
  const landmark = clampString(input.landmark, SCHEMA_LIMITS.LANDMARK_MAX);
  const ward = clampString(input.ward, SCHEMA_LIMITS.WARD_MAX);
  const reporterName = clampString(input.reporterName || 'Village Resident', SCHEMA_LIMITS.DISPLAY_NAME_MAX);

  if (title.length < SCHEMA_LIMITS.TITLE_MIN) {
    throw new Error('Issue title must be at least 5 characters.');
  }
  if (description.length < SCHEMA_LIMITS.DESCRIPTION_MIN) {
    throw new Error('Please provide at least 10 characters describing the issue.');
  }
  if (landmark.length < SCHEMA_LIMITS.LANDMARK_MIN) {
    throw new Error('Please specify a nearby landmark.');
  }
  if (input.photoUrl.length > SCHEMA_LIMITS.PHOTO_MAX) {
    throw new Error('Photo exceeds the 100 KB size limit.');
  }

  const requestId = generateId('req');
  const trackingCode = generateTrackingCode();
  const monthKey = getCurrentMonthKey();

  const hasValidCoords =
    typeof input.lat === 'number' &&
    typeof input.lng === 'number' &&
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng) &&
    input.lat >= -90 &&
    input.lat <= 90 &&
    input.lng >= -180 &&
    input.lng <= 180;

  const payload = {
    trackingCode,
    title,
    description,
    category: input.category,
    ward,
    landmark,
    ...(hasValidCoords
      ? { lat: Number(input.lat!.toFixed(6)), lng: Number(input.lng!.toFixed(6)) }
      : {}),
    status: 'Submitted' as IssueStatus,
    priority: input.priority,
    photoUrl: input.photoUrl,
    resolutionPhotoUrl: '',
    reporterUid: input.reporterUid,
    reporterName: reporterName.length >= 2 ? reporterName : 'Village Resident',
    assignedOfficerUid: '',
    assignedOfficerName: '',
    officerNotes: '',
    estimatedBudget: 0,
    monthKey,
    visibility: 'public' as const,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'serviceRequests', requestId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `serviceRequests/${requestId}`);
  }

  // Record initial audit entry
  const updateId = generateId('upd');
  try {
    await setDoc(doc(db, 'serviceRequests', requestId, 'updates', updateId), {
      requestId,
      authorUid: input.reporterUid,
      authorName: payload.reporterName,
      authorRole: 'Public Citizen' as RoleLabel,
      previousStatus: 'Submitted' as IssueStatus,
      newStatus: 'Submitted' as IssueStatus,
      note: clampString(
        `Issue reported at ${landmark} (${ward}). Awaiting ward officer verification.`,
        SCHEMA_LIMITS.UPDATE_NOTE_MAX,
      ),
      visibility: 'public' as const,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `serviceRequests/${requestId}/updates/${updateId}`,
    );
  }

  // Confirmation notification for villager
  const notifId = generateId('ntf');
  try {
    await setDoc(doc(db, 'notifications', notifId), {
      recipientUid: input.reporterUid,
      senderUid: input.reporterUid,
      requestId,
      title: clampString(`Registered: ${trackingCode}`, SCHEMA_LIMITS.NOTIF_TITLE_MAX),
      message: clampString(
        `Your report "${title}" has been logged for ${ward}. You will receive real-time alerts on every update.`,
        SCHEMA_LIMITS.NOTIF_MESSAGE_MAX,
      ),
      type: 'status_update' as NotificationType,
      isRead: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `notifications/${notifId}`);
  }

  return requestId;
}

export interface UpdateRequestStatusInput {
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
}

export async function updateServiceRequestProgress(
  input: UpdateRequestStatusInput,
): Promise<void> {
  const { request } = input;
  const noteText = clampString(input.officerNotes, SCHEMA_LIMITS.OFFICER_NOTES_MAX);
  const safeBudget = Math.max(0, Math.min(SCHEMA_LIMITS.BUDGET_MAX, Math.round(input.estimatedBudget || 0)));

  if (input.resolutionPhotoUrl.length > SCHEMA_LIMITS.PHOTO_MAX) {
    throw new Error('Resolution photo exceeds 100 KB limit.');
  }

  try {
    await updateDoc(doc(db, 'serviceRequests', request.id), {
      status: input.newStatus,
      priority: input.priority,
      assignedOfficerUid: clampString(input.assignedOfficerUid, SCHEMA_LIMITS.ID_MAX),
      assignedOfficerName: clampString(input.assignedOfficerName, SCHEMA_LIMITS.DISPLAY_NAME_MAX),
      officerNotes: noteText,
      estimatedBudget: safeBudget,
      resolutionPhotoUrl: input.resolutionPhotoUrl,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `serviceRequests/${request.id}`);
  }

  const updateId = generateId('upd');
  const auditNote = clampString(
    noteText.length >= 3
      ? noteText
      : `Status updated from ${request.status} to ${input.newStatus}.`,
    SCHEMA_LIMITS.UPDATE_NOTE_MAX,
  );
  try {
    await setDoc(doc(db, 'serviceRequests', request.id, 'updates', updateId), {
      requestId: request.id,
      authorUid: input.actorUid,
      authorName: clampString(input.actorName, SCHEMA_LIMITS.DISPLAY_NAME_MAX),
      authorRole: input.actorRoleLabel,
      previousStatus: request.status,
      newStatus: input.newStatus,
      note: auditNote,
      visibility: 'public' as const,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `serviceRequests/${request.id}/updates/${updateId}`,
    );
  }

  // Real-time progress notification for the reporting villager
  const notifId = generateId('ntf');
  try {
    await setDoc(doc(db, 'notifications', notifId), {
      recipientUid: request.reporterUid,
      senderUid: input.actorUid,
      requestId: request.id,
      title: clampString(
        `${request.trackingCode} is now ${input.newStatus}`,
        SCHEMA_LIMITS.NOTIF_TITLE_MAX,
      ),
      message: clampString(
        `${input.actorName} (${input.actorRoleLabel}): ${auditNote}`,
        SCHEMA_LIMITS.NOTIF_MESSAGE_MAX,
      ),
      type: 'status_update' as NotificationType,
      isRead: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `notifications/${notifId}`);
  }
}

export async function deleteServiceRequest(requestId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'serviceRequests', requestId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `serviceRequests/${requestId}`);
  }
}

export function subscribeMonthlyReports(
  onData: (reports: MonthlyReport[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'monthlyReports'), where('isPublished', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<MonthlyReport, 'id'>) }))
        .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'monthlyReports');
    },
  );
}

export async function publishMonthlyReport(params: {
  monthKey: string;
  requests: ServiceRequest[];
  summaryText: string;
  actionPlan: string;
  actorUid: string;
  actorName: string;
}): Promise<void> {
  const { monthKey, requests, actorUid, actorName } = params;
  if (!SCHEMA_LIMITS.MONTH_KEY_PATTERN.test(monthKey)) {
    throw new Error('Invalid month format. Expected YYYY-MM.');
  }

  const monthRequests = requests.filter((r) => r.monthKey === monthKey);
  const totalRequests = monthRequests.length;
  const resolvedCount = monthRequests.filter(
    (r) => r.status === 'Resolved' || r.status === 'Closed',
  ).length;
  const inProgressCount = monthRequests.filter((r) => r.status === 'In Progress').length;
  const verifiedCount = monthRequests.filter((r) => r.status === 'Verified').length;
  const pendingCount = monthRequests.filter((r) => r.status === 'Submitted').length;
  const resolutionRate =
    totalRequests > 0 ? Math.round((resolvedCount / totalRequests) * 100) : 0;
  const totalSanctionedBudget = monthRequests.reduce(
    (sum, r) => sum + (Number(r.estimatedBudget) || 0),
    0,
  );

  const categoryCounts = new Map<string, number>();
  for (const req of monthRequests) {
    categoryCounts.set(req.category, (categoryCounts.get(req.category) || 0) + 1);
  }
  let topCategory = 'General Civic Works';
  let bestCount = 0;
  for (const [cat, count] of categoryCounts.entries()) {
    if (count > bestCount) {
      bestCount = count;
      topCategory = cat;
    }
  }

  const summaryText = clampString(params.summaryText, SCHEMA_LIMITS.REPORT_SUMMARY_MAX);
  if (summaryText.length < SCHEMA_LIMITS.REPORT_SUMMARY_MIN) {
    throw new Error('Report summary must be at least 10 characters.');
  }
  const actionPlan = clampString(params.actionPlan, SCHEMA_LIMITS.REPORT_ACTION_MAX);
  const monthLabel = formatMonthLabel(monthKey);
  const reportRef = doc(db, 'monthlyReports', monthKey);

  let exists = false;
  try {
    const existingSnap = await getDoc(reportRef);
    exists = existingSnap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `monthlyReports/${monthKey}`);
  }

  if (exists) {
    try {
      await updateDoc(reportRef, {
        monthLabel,
        totalRequests,
        resolvedCount,
        inProgressCount,
        verifiedCount,
        pendingCount,
        resolutionRate,
        totalSanctionedBudget,
        topCategory,
        summaryText,
        actionPlan,
        publishedByUid: actorUid,
        publishedByName: clampString(actorName, SCHEMA_LIMITS.DISPLAY_NAME_MAX),
        isPublished: true,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `monthlyReports/${monthKey}`);
    }
  } else {
    try {
      await setDoc(reportRef, {
        monthKey,
        monthLabel,
        totalRequests,
        resolvedCount,
        inProgressCount,
        verifiedCount,
        pendingCount,
        resolutionRate,
        totalSanctionedBudget,
        topCategory,
        summaryText,
        actionPlan,
        publishedByUid: actorUid,
        publishedByName: clampString(actorName, SCHEMA_LIMITS.DISPLAY_NAME_MAX),
        isPublished: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `monthlyReports/${monthKey}`);
    }
  }

  // Broadcast report published notice to all citizens
  const notifId = generateId('ntf');
  try {
    await setDoc(doc(db, 'notifications', notifId), {
      recipientUid: 'all',
      senderUid: actorUid,
      requestId: '',
      title: clampString(`Monthly Transparency Report: ${monthLabel}`, SCHEMA_LIMITS.NOTIF_TITLE_MAX),
      message: clampString(
        `${monthLabel} status report published (${resolvedCount}/${totalRequests} resolved, ${resolutionRate}% completion). Open Reports to inspect full ward records.`,
        SCHEMA_LIMITS.NOTIF_MESSAGE_MAX,
      ),
      type: 'report_published' as NotificationType,
      isRead: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `notifications/${notifId}`);
  }
}

export function subscribeNotifications(
  userUid: string,
  onData: (notifications: PortalNotification[]) => void,
): Unsubscribe {
  let personalItems: PortalNotification[] = [];
  let broadcastItems: PortalNotification[] = [];

  const emitMerged = () => {
    const merged = [...personalItems, ...broadcastItems].sort((a, b) => {
      const at = a.createdAt?.toMillis() ?? Date.now();
      const bt = b.createdAt?.toMillis() ?? Date.now();
      return bt - at;
    });
    onData(merged);
  };

  const unsubPersonal = onSnapshot(
    query(collection(db, 'notifications'), where('recipientUid', '==', userUid)),
    (snap) => {
      personalItems = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PortalNotification, 'id'>),
      }));
      emitMerged();
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications/personal');
    },
  );

  const unsubBroadcast = onSnapshot(
    query(collection(db, 'notifications'), where('recipientUid', '==', 'all')),
    (snap) => {
      broadcastItems = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PortalNotification, 'id'>),
      }));
      emitMerged();
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications/broadcast');
    },
  );

  return () => {
    unsubPersonal();
    unsubBroadcast();
  };
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      isRead: true,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

export async function broadcastVillageNotice(params: {
  title: string;
  message: string;
  actorUid: string;
}): Promise<void> {
  const title = clampString(params.title, SCHEMA_LIMITS.NOTIF_TITLE_MAX);
  const message = clampString(params.message, SCHEMA_LIMITS.NOTIF_MESSAGE_MAX);
  if (title.length < SCHEMA_LIMITS.NOTIF_TITLE_MIN) {
    throw new Error('Notice title must be at least 3 characters.');
  }
  if (message.length < SCHEMA_LIMITS.NOTIF_MESSAGE_MIN) {
    throw new Error('Notice message must be at least 5 characters.');
  }

  const notifId = generateId('ntf');
  try {
    await setDoc(doc(db, 'notifications', notifId), {
      recipientUid: 'all',
      senderUid: params.actorUid,
      requestId: '',
      title,
      message,
      type: 'public_notice' as NotificationType,
      isRead: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `notifications/${notifId}`);
  }
}

export async function setMemberRole(params: {
  targetUid: string;
  newRole: AccessRole;
  designation: string;
  actorUid: string;
}): Promise<void> {
  const { targetUid, newRole, actorUid } = params;
  const safeDesignation = clampString(
    params.designation || roleToLabel(newRole),
    SCHEMA_LIMITS.DISPLAY_NAME_MAX,
  );
  const finalDesignation = safeDesignation.length >= 2 ? safeDesignation : roleToLabel(newRole);

  const adminRef = doc(db, 'admins', targetUid);
  const authRef = doc(db, 'authorizedStaff', targetUid);

  try {
    if (newRole === 'admin') {
      await setDoc(adminRef, {
        uid: targetUid,
        role: 'admin',
        grantedBy: actorUid,
        designation: finalDesignation,
        createdAt: serverTimestamp(),
      });
      await deleteDoc(authRef).catch(() => undefined);
    } else if (newRole === 'authorized') {
      await setDoc(authRef, {
        uid: targetUid,
        role: 'authorized',
        grantedBy: actorUid,
        designation: finalDesignation,
        createdAt: serverTimestamp(),
      });
      await deleteDoc(adminRef).catch(() => undefined);
    } else {
      await deleteDoc(adminRef).catch(() => undefined);
      await deleteDoc(authRef).catch(() => undefined);
    }

    await updateDoc(doc(db, 'users', targetUid), {
      roleLabel: roleToLabel(newRole),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `roles/${targetUid}`);
  }
}

export async function seedInitialPanchayatData(actorUid: string, actorName: string): Promise<void> {
  const monthKey = getCurrentMonthKey();
  const safeActorName = clampString(actorName || 'Panchayat Secretary', SCHEMA_LIMITS.DISPLAY_NAME_MAX);

  const sampleRecords: Array<{
    id: string;
    trackingCode: string;
    title: string;
    description: string;
    category: IssueCategory;
    ward: string;
    landmark: string;
    status: IssueStatus;
    priority: IssuePriority;
    photoUrl: string;
    assignedOfficerName: string;
    officerNotes: string;
    estimatedBudget: number;
  }> = [
    {
      id: 'seed-water-01',
      trackingCode: 'GP-2026-1041',
      title: 'Leaking public drinking water standpipe near Old Well',
      description:
        'Main brass valve on the community drinking water standpipe has been leaking continuously since early morning, flooding the stone path used by school children.',
      category: 'Water Supply',
      ward: 'Ward 2 - Temple Street',
      landmark: 'Beside Lakshmi Temple Stone Lane',
      status: 'In Progress',
      priority: 'High',
      photoUrl: GENERATED_ASSETS.waterPipeline,
      assignedOfficerName: 'K. Manjunath (Water Technician)',
      officerNotes: 'Replacement gate valve and elbow joint issued from Panchayat store. Plumbing crew scheduled today.',
      estimatedBudget: 4800,
    },
    {
      id: 'seed-road-02',
      trackingCode: 'GP-2026-1042',
      title: 'Crumbled asphalt shoulder and potholes along Paddy Field Link Road',
      description:
        'Monsoon runoff eroded the left shoulder of the link road connecting Ward 3 farms to the dairy collection booth. Two-wheelers and milk carts face difficulty.',
      category: 'Roads & Drainage',
      ward: 'Ward 3 - Tank Bund',
      landmark: '200m east of Milk Cooperative Booth',
      status: 'Verified',
      priority: 'Urgent',
      photoUrl: GENERATED_ASSETS.villageRoad,
      assignedOfficerName: 'S. Savitha (Junior Engineer)',
      officerNotes: 'Site measured (42m stretch). Gravel compaction and wet-mix patch estimate submitted for sanction.',
      estimatedBudget: 38500,
    },
    {
      id: 'seed-light-03',
      trackingCode: 'GP-2026-1043',
      title: 'Solar LED streetlight battery controller replaced on North Lane',
      description:
        'Pole #14 solar streetlight stopped turning on after dusk, leaving the pedestrian crossing near the Anganwadi center dark.',
      category: 'Street Lighting',
      ward: 'Ward 4 - School Road',
      landmark: 'Opposite Government Primary School Gate',
      status: 'Resolved',
      priority: 'Medium',
      photoUrl: GENERATED_ASSETS.solarStreetlight,
      assignedOfficerName: 'R. Prakash (Electrical Assistant)',
      officerNotes: 'Faulty LiFePO4 charge controller replaced and panel cleaned. Verified luminous output at 6:30 PM.',
      estimatedBudget: 6200,
    },
    {
      id: 'seed-sanit-04',
      trackingCode: 'GP-2026-1044',
      title: 'Weekly desilting required for stormwater drain near Agri Market',
      description:
        'Silt and dry leaves have accumulated near the culvert grating outside the Thursday vegetable market yard.',
      category: 'Sanitation',
      ward: 'Ward 5 - Agri Market',
      landmark: 'South Entrance of Weekly Shandy Yard',
      status: 'Submitted',
      priority: 'Medium',
      photoUrl: '',
      assignedOfficerName: '',
      officerNotes: '',
      estimatedBudget: 0,
    },
  ];

  for (const item of sampleRecords) {
    try {
      await setDoc(doc(db, 'serviceRequests', item.id), {
        trackingCode: item.trackingCode,
        title: item.title,
        description: item.description,
        category: item.category,
        ward: item.ward,
        landmark: item.landmark,
        status: item.status,
        priority: item.priority,
        photoUrl: item.photoUrl,
        resolutionPhotoUrl: '',
        reporterUid: actorUid,
        reporterName: safeActorName,
        assignedOfficerUid: item.assignedOfficerName ? actorUid : '',
        assignedOfficerName: item.assignedOfficerName,
        officerNotes: item.officerNotes,
        estimatedBudget: item.estimatedBudget,
        monthKey,
        visibility: 'public',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'serviceRequests', item.id, 'updates', `init-${item.id}`), {
        requestId: item.id,
        authorUid: actorUid,
        authorName: safeActorName,
        authorRole: 'Administrative Staff',
        previousStatus: 'Submitted',
        newStatus: item.status,
        note: item.officerNotes || 'Logged into Shantinagar Gram Panchayat service register.',
        visibility: 'public',
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `serviceRequests/${item.id}`);
    }
  }

  // Publish baseline Monthly Transparency Report
  const monthLabel = formatMonthLabel(monthKey);
  try {
    await setDoc(doc(db, 'monthlyReports', monthKey), {
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
      publishedByUid: actorUid,
      publishedByName: safeActorName,
      isPublished: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `monthlyReports/${monthKey}`);
  }

  // Welcome village notice
  try {
    await setDoc(doc(db, 'notifications', `welcome-${monthKey}`), {
      recipientUid: 'all',
      senderUid: actorUid,
      requestId: '',
      title: `Gram Sabha Transparency Update — ${monthLabel}`,
      message:
        'Villagers can now upload site photos for local water, road, streetlight, and sanitation issues and follow real-time officer updates here.',
      type: 'public_notice',
      isRead: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `notifications/welcome-${monthKey}`);
  }
}
