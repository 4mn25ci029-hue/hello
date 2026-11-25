/**
 * Phase 0 Security Test Specification for GramSetu Firestore Rules.
 * Verifies that all 12 adversarial "Dirty Dozen" payloads from security_spec.md
 * are rejected with PERMISSION_DENIED when executed against the Firebase Emulator Suite.
 */

export interface AdversarialCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  actor: {
    uid: string;
    email: string;
    emailVerified: boolean;
    role: 'public' | 'authorized' | 'admin';
  };
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: AdversarialCase[] = [
  {
    id: 1,
    name: 'Self-Assigned Admin Role Grant',
    collectionPath: 'admins/citizen-1',
    operation: 'create',
    actor: { uid: 'citizen-1', email: 'c1@example.com', emailVerified: true, role: 'public' },
    payload: { uid: 'citizen-1', role: 'admin', grantedBy: 'citizen-1', designation: 'Self Admin' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Self-Assigned Admin RoleLabel in UserProfile',
    collectionPath: 'users/citizen-1',
    operation: 'create',
    actor: { uid: 'citizen-1', email: 'c1@example.com', emailVerified: true, role: 'public' },
    payload: {
      uid: 'citizen-1',
      displayName: 'Citizen One',
      ward: 'Ward 1',
      roleLabel: 'Administrative Staff',
      isDirectoryVisible: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Admin Email Spoof Attack',
    collectionPath: 'monthlyReports/2026-11',
    operation: 'create',
    actor: {
      uid: 'spoof-uid',
      email: 'laharbalakrishnagowda@gmail.com',
      emailVerified: false,
      role: 'public',
    },
    payload: { monthKey: '2026-11', monthLabel: 'November 2026', isPublished: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Cross-User Private PII Read',
    collectionPath: 'users/citizen-1/private/contact',
    operation: 'get',
    actor: { uid: 'citizen-2', email: 'c2@example.com', emailVerified: true, role: 'public' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Private PII Collection List Scrape',
    collectionPath: 'users/citizen-1/private',
    operation: 'list',
    actor: { uid: 'citizen-1', email: 'c1@example.com', emailVerified: true, role: 'public' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Shadow Ghost Field Injection on ServiceRequest',
    collectionPath: 'serviceRequests/req-shadow',
    operation: 'create',
    actor: { uid: 'citizen-1', email: 'c1@example.com', emailVerified: true, role: 'public' },
    payload: {
      trackingCode: 'GP-2026-9999',
      title: 'Broken Pipe',
      description: 'Water pipe leaking near school.',
      category: 'Water Supply',
      ward: 'Ward 1',
      landmark: 'Primary School',
      status: 'Submitted',
      priority: 'Medium',
      photoUrl: '',
      resolutionPhotoUrl: '',
      reporterUid: 'citizen-1',
      reporterName: 'Citizen One',
      assignedOfficerUid: '',
      assignedOfficerName: '',
      officerNotes: '',
      estimatedBudget: 0,
      monthKey: '2026-11',
      visibility: 'public',
      isApproved: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Identity Spoofing on ServiceRequest',
    collectionPath: 'serviceRequests/req-spoof',
    operation: 'create',
    actor: { uid: 'citizen-2', email: 'c2@example.com', emailVerified: true, role: 'public' },
    payload: { reporterUid: 'citizen-1', title: 'Spoofed report' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'State Shortcutting by Public Citizen',
    collectionPath: 'serviceRequests/req-shortcut',
    operation: 'create',
    actor: { uid: 'citizen-1', email: 'c1@example.com', emailVerified: true, role: 'public' },
    payload: { reporterUid: 'citizen-1', status: 'Resolved' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Terminal Closed Status Mutation by Non-Admin Officer',
    collectionPath: 'serviceRequests/req-closed',
    operation: 'update',
    actor: { uid: 'officer-1', email: 'o1@example.com', emailVerified: true, role: 'authorized' },
    payload: { status: 'In Progress', officerNotes: 'Reopening closed ticket' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Path Variable ID Poisoning',
    collectionPath: 'serviceRequests/' + 'a'.repeat(180),
    operation: 'create',
    actor: { uid: 'citizen-1', email: 'c1@example.com', emailVerified: true, role: 'public' },
    payload: { title: 'Oversized ID attack' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Value Poisoning on Notification Read Toggle',
    collectionPath: 'notifications/notif-1',
    operation: 'update',
    actor: { uid: 'citizen-1', email: 'c1@example.com', emailVerified: true, role: 'public' },
    payload: { isRead: true, message: 'Tampered notification text' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unauthorized Village-Wide Broadcast Notification',
    collectionPath: 'notifications/notif-broadcast',
    operation: 'create',
    actor: { uid: 'citizen-1', email: 'c1@example.com', emailVerified: true, role: 'public' },
    payload: {
      recipientUid: 'all',
      senderUid: 'citizen-1',
      requestId: '',
      title: 'Fake Emergency',
      message: 'Unauthorized village broadcast',
      type: 'public_notice',
      isRead: false,
    },
    expected: 'PERMISSION_DENIED',
  },
];
