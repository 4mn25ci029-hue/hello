import React, { useState } from 'react';
import { CheckCircle2, Database, LogOut, Shield, Users } from 'lucide-react';
import {
  SCHEMA_LIMITS,
  VILLAGE_WARDS,
  type AccessRole,
  type UserPrivateContact,
  type UserProfile,
} from '../types';
import {
  demoResetSampleData,
  demoUpdateMemberRole,
  demoUpdateOwnProfile,
  type DemoSessionUser,
} from '../utils/demoStore';
import {
  seedInitialPanchayatData,
  setMemberRole,
  updateOwnProfile,
} from '../utils/panchayatService';

interface AdminStaffPanelProps {
  currentUserUid: string;
  currentUserEmail: string;
  profile: UserProfile | null;
  contact: UserPrivateContact | null;
  directoryUsers: UserProfile[];
  activeMode: AccessRole;
  actualRole: AccessRole;
  requestCount: number;
  isDemoMode: boolean;
  demoSession: DemoSessionUser | null;
  onDemoSessionChange?: (next: DemoSessionUser) => void;
  onSignOut: () => void;
  onProfileUpdated: () => void;
}

export function AdminStaffPanel({
  currentUserUid,
  currentUserEmail,
  profile,
  contact,
  directoryUsers,
  activeMode,
  actualRole,
  requestCount,
  isDemoMode,
  demoSession,
  onDemoSessionChange,
  onSignOut,
  onProfileUpdated,
}: AdminStaffPanelProps) {
  const isAdminStaff = activeMode === 'admin' && actualRole === 'admin';

  // Own profile editor state
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [ward, setWard] = useState(profile?.ward || VILLAGE_WARDS[0]);
  const [phone, setPhone] = useState(contact?.phone || '');
  const [address, setAddress] = useState(contact?.address || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);

  // Admin role assignment state
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [roleFeedback, setRoleFeedback] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    setProfileErr(null);
    try {
      if (isDemoMode && demoSession) {
        const next = demoUpdateOwnProfile(demoSession, {
          displayName,
          ward,
          phone,
          address,
        });
        onDemoSessionChange?.(next);
      } else {
        await updateOwnProfile(currentUserUid, {
          displayName,
          ward,
          phone,
          address,
          email: currentUserEmail,
        });
      }
      setProfileMsg('Profile and private contact record updated.');
      onProfileUpdated();
    } catch (err) {
      setProfileErr(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAssignRole = async (member: UserProfile, newRole: AccessRole) => {
    if (!isAdminStaff) return;
    setBusyUid(member.uid);
    setRoleFeedback(null);
    try {
      if (isDemoMode) {
        demoUpdateMemberRole(member.uid, newRole);
      } else {
        await setMemberRole({
          targetUid: member.uid,
          newRole,
          designation:
            newRole === 'admin'
              ? 'Panchayat Secretary / Admin Staff'
              : newRole === 'authorized'
                ? `Ward Field Officer (${member.ward})`
                : 'Public Citizen',
          actorUid: currentUserUid,
        });
      }
      setRoleFeedback(`Updated ${member.displayName}'s access role.`);
    } catch (err) {
      setRoleFeedback(err instanceof Error ? err.message : 'Role update failed.');
    } finally {
      setBusyUid(null);
    }
  };

  const handleSeedSample = async () => {
    if (!isAdminStaff) return;
    setSeeding(true);
    setRoleFeedback(null);
    try {
      if (isDemoMode) {
        demoResetSampleData();
      } else {
        await seedInitialPanchayatData(
          currentUserUid,
          profile?.displayName || 'Panchayat Secretary',
        );
      }
      setRoleFeedback('Loaded GramDev sample requests, field photos, and monthly report.');
    } catch (err) {
      setRoleFeedback(err instanceof Error ? err.message : 'Failed to load sample records.');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-mono text-slate-500">Account & Governance</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
            {isAdminStaff ? 'Administrative Staff & Account Settings' : 'Citizen Profile & Access'}
          </h1>
          <p className="text-sm text-slate-600">
            Manage your ward profile and private contact information. Administrative staff can also assign ward officer roles below.
          </p>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors flex items-center gap-2 self-start sm:self-auto whitespace-nowrap"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      {/* Own Profile Form */}
      <form
        onSubmit={handleSaveProfile}
        className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200/80">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              My Resident & Contact Details
            </h2>
            <p className="text-xs text-slate-500">
              Your phone number and street address stay in an isolated private record.
            </p>
          </div>
          <span className="text-xs font-mono text-emerald-800 font-semibold">
            Assigned Access: {profile?.roleLabel || 'Public Citizen'}
          </span>
        </div>

        {profileErr && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
            {profileErr}
          </div>
        )}
        {profileMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{profileMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="prof-name" className="block text-xs font-semibold text-slate-700">
              Full Name
            </label>
            <input
              id="prof-name"
              type="text"
              required
              minLength={SCHEMA_LIMITS.DISPLAY_NAME_MIN}
              maxLength={SCHEMA_LIMITS.DISPLAY_NAME_MAX}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="prof-ward" className="block text-xs font-semibold text-slate-700">
              Residential Ward
            </label>
            <select
              id="prof-ward"
              value={ward}
              onChange={(e) => setWard(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
            >
              {VILLAGE_WARDS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="prof-phone" className="block text-xs font-semibold text-slate-700">
              Private Mobile Number
            </label>
            <input
              id="prof-phone"
              type="tel"
              maxLength={SCHEMA_LIMITS.PHONE_MAX}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit mobile number"
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono tabular-nums text-slate-900"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="prof-addr" className="block text-xs font-semibold text-slate-700">
              Private House / Street Address
            </label>
            <input
              id="prof-addr"
              type="text"
              maxLength={SCHEMA_LIMITS.ADDRESS_MAX}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="House number, lane, post"
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-mono text-slate-500 truncate max-w-[240px]">
            {currentUserEmail}
          </span>
          <button
            type="submit"
            disabled={savingProfile}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-emerald-900 text-white text-sm font-semibold hover:bg-emerald-800 transition-colors disabled:opacity-60"
          >
            {savingProfile ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>

      {/* Administrative Staff Role Management */}
      {isAdminStaff && (
        <div className="space-y-6">
          {/* Quick Panchayat Demo Register Loader */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-emerald-800">
                <Database className="w-4 h-4" />
                <h2 className="font-display text-base font-bold text-slate-900">
                  Panchayat Sample Register
                </h2>
              </div>
              <p className="text-xs text-slate-600 max-w-xl">
                Populate Firestore with 4 realistic Shantinagar village service tickets (water pipeline, link road, solar streetlight, market drain) with documentary photos and a published monthly transparency report.
              </p>
            </div>
            <button
              type="button"
              disabled={seeding}
              onClick={handleSeedSample}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              {seeding
                ? 'Loading Records...'
                : requestCount > 0
                  ? 'Add Sample Records'
                  : 'Load Sample Records'}
            </button>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b border-slate-200/80 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-800" />
                  Portal Role Access Control ({directoryUsers.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Assign Authorized Field Officer or Administrative Staff permissions backed by Firestore security rules.
                </p>
              </div>
              <Shield className="w-5 h-5 text-slate-400 shrink-0" />
            </div>

            {roleFeedback && (
              <div className="mx-5 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                {roleFeedback}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/70 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-5">Member</th>
                    <th className="py-3 px-4">Ward</th>
                    <th className="py-3 px-4">Current Role</th>
                    <th className="py-3 px-5 text-right">Assign Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 text-sm">
                  {directoryUsers.map((member) => {
                    const isSelf = member.uid === currentUserUid;
                    return (
                      <tr key={member.uid} className="hover:bg-slate-50/70">
                        <td className="py-3 px-5">
                          <p className="font-semibold text-slate-900">
                            {member.displayName} {isSelf ? '(You)' : ''}
                          </p>
                          <p className="text-xs font-mono text-slate-500">{member.uid.slice(0, 14)}</p>
                        </td>
                        <td className="py-3 px-4 text-slate-700">{member.ward}</td>
                        <td className="py-3 px-4 text-xs font-semibold text-slate-800">
                          {member.roleLabel}
                        </td>
                        <td className="py-3 px-5 text-right">
                          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                            {(
                              [
                                { id: 'public', label: 'Public' },
                                { id: 'authorized', label: 'Officer' },
                                { id: 'admin', label: 'Admin' },
                              ] as const
                            ).map((opt) => {
                              const active =
                                (opt.id === 'public' && member.roleLabel === 'Public Citizen') ||
                                (opt.id === 'authorized' && member.roleLabel === 'Authorized Officer') ||
                                (opt.id === 'admin' && member.roleLabel === 'Administrative Staff');
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  disabled={busyUid === member.uid || (isSelf && opt.id !== 'admin')}
                                  onClick={() => void handleAssignRole(member, opt.id)}
                                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap disabled:opacity-50 ${
                                    active
                                      ? 'bg-white text-slate-900 shadow-xs'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
