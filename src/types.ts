import type { Timestamp } from 'firebase/firestore';

export type AccessRole = 'public' | 'authorized' | 'admin';

export type RoleLabel = 'Public Citizen' | 'Authorized Officer' | 'Administrative Staff';

export type IssueCategory =
  | 'Water Supply'
  | 'Roads & Drainage'
  | 'Street Lighting'
  | 'Sanitation'
  | 'Electricity'
  | 'Public Health';

export type IssueStatus = 'Submitted' | 'Verified' | 'In Progress' | 'Resolved' | 'Closed';

export type IssuePriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export type NotificationType =
  | 'status_update'
  | 'assignment'
  | 'report_published'
  | 'public_notice';

export const ISSUE_CATEGORIES: IssueCategory[] = [
  'Water Supply',
  'Roads & Drainage',
  'Street Lighting',
  'Sanitation',
  'Electricity',
  'Public Health',
];

export const ISSUE_STATUSES: IssueStatus[] = [
  'Submitted',
  'Verified',
  'In Progress',
  'Resolved',
  'Closed',
];

export const ISSUE_PRIORITIES: IssuePriority[] = ['Low', 'Medium', 'High', 'Urgent'];

export const VILLAGE_WARDS: string[] = [
  'Ward 1 - East Layout',
  'Ward 2 - Temple Street',
  'Ward 3 - Tank Bund',
  'Ward 4 - School Road',
  'Ward 5 - Agri Market',
  'Ward 6 - North Extension',
];

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export const VILLAGE_CENTER: LatLngLiteral = {
  lat: 12.2958,
  lng: 76.6394,
};

export const WARD_COORDINATES: Record<string, LatLngLiteral> = {
  'Ward 1 - East Layout': { lat: 12.2974, lng: 76.6448 },
  'Ward 2 - Temple Street': { lat: 12.2946, lng: 76.6382 },
  'Ward 3 - Tank Bund': { lat: 12.2921, lng: 76.6345 },
  'Ward 4 - School Road': { lat: 12.2991, lng: 76.6371 },
  'Ward 5 - Agri Market': { lat: 12.2935, lng: 76.6439 },
  'Ward 6 - North Extension': { lat: 12.3016, lng: 76.6412 },
};

/**
 * Synchronized verbatim with firebase-blueprint.json and firestore.rules
 */
export const SCHEMA_LIMITS = {
  ID_MAX: 128,
  ID_PATTERN: /^[a-zA-Z0-9_\-]+$/,
  DISPLAY_NAME_MIN: 2,
  DISPLAY_NAME_MAX: 80,
  WARD_MIN: 2,
  WARD_MAX: 40,
  EMAIL_MAX: 160,
  PHONE_MAX: 20,
  ADDRESS_MAX: 200,
  TITLE_MIN: 5,
  TITLE_MAX: 120,
  DESCRIPTION_MIN: 10,
  DESCRIPTION_MAX: 1000,
  LANDMARK_MIN: 2,
  LANDMARK_MAX: 120,
  PHOTO_MAX: 100000,
  OFFICER_NOTES_MAX: 600,
  BUDGET_MAX: 50000000,
  UPDATE_NOTE_MIN: 3,
  UPDATE_NOTE_MAX: 500,
  REPORT_SUMMARY_MIN: 10,
  REPORT_SUMMARY_MAX: 1500,
  REPORT_ACTION_MAX: 1000,
  NOTIF_TITLE_MIN: 3,
  NOTIF_TITLE_MAX: 120,
  NOTIF_MESSAGE_MIN: 5,
  NOTIF_MESSAGE_MAX: 400,
  MONTH_KEY_PATTERN: /^[0-9]{4}-[0-9]{2}$/,
} as const;

export const GENERATED_ASSETS = {
  heroPanchayat: '/src/assets/images/hero_panchayat_office_1795332739027.jpg',
  waterPipeline: '/src/assets/images/issue_water_pipeline_1795332738193.jpg',
  villageRoad: '/src/assets/images/issue_village_road_1795332740452.jpg',
  solarStreetlight: '/src/assets/images/issue_solar_streetlight_1795332739251.jpg',
} as const;

export interface UserProfile {
  uid: string;
  displayName: string;
  ward: string;
  roleLabel: RoleLabel;
  isDirectoryVisible: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface UserPrivateContact {
  uid: string;
  email: string;
  phone: string;
  address: string;
  updatedAt: Timestamp | null;
}

export interface ServiceRequest {
  id: string;
  trackingCode: string;
  title: string;
  description: string;
  category: IssueCategory;
  ward: string;
  landmark: string;
  lat?: number;
  lng?: number;
  status: IssueStatus;
  priority: IssuePriority;
  photoUrl: string;
  resolutionPhotoUrl: string;
  reporterUid: string;
  reporterName: string;
  assignedOfficerUid: string;
  assignedOfficerName: string;
  officerNotes: string;
  estimatedBudget: number;
  monthKey: string;
  visibility: 'public';
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export function getRequestCoordinates(req: Pick<ServiceRequest, 'id' | 'ward' | 'lat' | 'lng'>): LatLngLiteral {
  if (
    typeof req.lat === 'number' &&
    typeof req.lng === 'number' &&
    Number.isFinite(req.lat) &&
    Number.isFinite(req.lng)
  ) {
    return { lat: req.lat, lng: req.lng };
  }
  const base = WARD_COORDINATES[req.ward] || VILLAGE_CENTER;
  let hash = 0;
  for (let i = 0; i < req.id.length; i++) {
    hash = (hash * 31 + req.id.charCodeAt(i)) % 1000;
  }
  const latOffset = ((hash % 20) - 10) * 0.00014;
  const lngOffset = (((Math.floor(hash / 20)) % 20) - 10) * 0.00014;
  return {
    lat: Number((base.lat + latOffset).toFixed(6)),
    lng: Number((base.lng + lngOffset).toFixed(6)),
  };
}

export interface ServiceUpdate {
  id: string;
  requestId: string;
  authorUid: string;
  authorName: string;
  authorRole: RoleLabel;
  previousStatus: IssueStatus;
  newStatus: IssueStatus;
  note: string;
  visibility: 'public';
  createdAt: Timestamp | null;
}

export interface MonthlyReport {
  id: string;
  monthKey: string;
  monthLabel: string;
  totalRequests: number;
  resolvedCount: number;
  inProgressCount: number;
  verifiedCount: number;
  pendingCount: number;
  resolutionRate: number;
  totalSanctionedBudget: number;
  topCategory: string;
  summaryText: string;
  actionPlan: string;
  publishedByUid: string;
  publishedByName: string;
  isPublished: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface PortalNotification {
  id: string;
  recipientUid: string;
  senderUid: string;
  requestId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: Timestamp | null;
}

export function formatMonthLabel(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const monthIdx = Number(monthStr) - 1;
  const date = new Date(year, monthIdx, 1);
  if (Number.isNaN(date.getTime())) return monthKey;
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export function getCurrentMonthKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function formatTimestamp(ts: Timestamp | null | undefined): string {
  if (!ts) return 'Just now';
  try {
    const d = ts.toDate();
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'Just now';
  }
}

export function formatTimestampWithTime(ts: Timestamp | null | undefined): string {
  if (!ts) return 'Just now';
  try {
    const d = ts.toDate();
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Just now';
  }
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
