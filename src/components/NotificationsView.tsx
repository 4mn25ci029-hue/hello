import React, { useState } from 'react';
import { Bell, Check, CheckCircle2, Megaphone, Send } from 'lucide-react';
import {
  formatTimestampWithTime,
  SCHEMA_LIMITS,
  type AccessRole,
  type PortalNotification,
} from '../types';
import { demoBroadcastNotice, demoMarkNotificationRead } from '../utils/demoStore';
import { broadcastVillageNotice, markNotificationRead } from '../utils/panchayatService';

interface NotificationsViewProps {
  notifications: PortalNotification[];
  userUid: string;
  activeMode: AccessRole;
  actualRole: AccessRole;
  isDemoMode: boolean;
  onOpenRequest: (requestId: string) => void;
}

export function NotificationsView({
  notifications,
  userUid,
  activeMode,
  actualRole,
  isDemoMode,
  onOpenRequest,
}: NotificationsViewProps) {
  const isAdminStaff = activeMode === 'admin' && actualRole === 'admin';
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sentFeedback, setSentFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const unreadPersonalCount = notifications.filter(
    (n) => n.recipientUid === userUid && !n.isRead,
  ).length;

  const markRead = async (id: string) => {
    if (isDemoMode) {
      demoMarkNotificationRead(id);
    } else {
      await markNotificationRead(id);
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminStaff) return;
    setSending(true);
    setError(null);
    setSentFeedback(null);
    try {
      if (isDemoMode) {
        demoBroadcastNotice({
          title: noticeTitle,
          message: noticeMessage,
          actorUid: userUid,
        });
      } else {
        await broadcastVillageNotice({
          title: noticeTitle,
          message: noticeMessage,
          actorUid: userUid,
        });
      }
      setNoticeTitle('');
      setNoticeMessage('');
      setSentFeedback('Village-wide notice broadcast in real time to all citizens.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send village notice.');
    } finally {
      setSending(false);
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => n.recipientUid === userUid && !n.isRead);
    await Promise.all(unread.map((n) => markRead(n.id)));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-mono text-slate-500">Live Progress Feed</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
            Notifications & Village Notices
          </h1>
          <p className="text-sm text-slate-600">
            Instant updates whenever a field officer verifies, assigns, or resolves your reported village issues.
          </p>
        </div>

        {unreadPersonalCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors flex items-center gap-2 self-start sm:self-auto whitespace-nowrap"
          >
            <Check className="w-4 h-4" />
            Mark {unreadPersonalCount} Read
          </button>
        )}
      </div>

      {/* Admin Broadcast Notice Composer */}
      {isAdminStaff && (
        <form
          onSubmit={handleBroadcast}
          className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <Megaphone className="w-5 h-5 text-emerald-800 shrink-0" />
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                Broadcast Public Gram Panchayat Notice
              </h2>
              <p className="text-xs text-slate-500">
                Push an immediate announcement (e.g., water supply timing, Gram Sabha date, vaccination camp) to all villagers.
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
              {error}
            </div>
          )}
          {sentFeedback && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{sentFeedback}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <input
              type="text"
              required
              minLength={SCHEMA_LIMITS.NOTIF_TITLE_MIN}
              maxLength={SCHEMA_LIMITS.NOTIF_TITLE_MAX}
              value={noticeTitle}
              onChange={(e) => setNoticeTitle(e.target.value)}
              placeholder="Notice heading (e.g. Overhead Tank Cleaning — Sunday 7 AM)"
              className="lg:col-span-5 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800"
            />
            <input
              type="text"
              required
              minLength={SCHEMA_LIMITS.NOTIF_MESSAGE_MIN}
              maxLength={SCHEMA_LIMITS.NOTIF_MESSAGE_MAX}
              value={noticeMessage}
              onChange={(e) => setNoticeMessage(e.target.value)}
              placeholder="Full announcement details for all village wards..."
              className="lg:col-span-5 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800"
            />
            <button
              type="submit"
              disabled={sending}
              className="lg:col-span-2 min-h-[44px] px-4 py-2 rounded-xl bg-emerald-900 text-white text-sm font-semibold hover:bg-emerald-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 whitespace-nowrap"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Sending...' : 'Broadcast'}
            </button>
          </div>
        </form>
      )}

      {/* Real-time Feed */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden">
        {notifications.length === 0 ? (
          <div className="py-16 px-6 text-center space-y-2">
            <Bell className="w-8 h-8 text-slate-300 mx-auto" />
            <h2 className="font-display text-base font-bold text-slate-900">
              No notifications yet
            </h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              When you report an issue or Panchayat officers post status updates and monthly reports, real-time notifications will appear here immediately.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200/80">
            {notifications.map((item) => {
              const isPersonalUnread = item.recipientUid === userUid && !item.isRead;
              const isBroadcast = item.recipientUid === 'all';
              return (
                <li
                  key={item.id}
                  className={`p-4 sm:p-5 transition-colors ${
                    isPersonalUnread ? 'bg-emerald-50/40' : 'bg-white'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                        <span
                          className={`font-semibold ${
                            isBroadcast ? 'text-emerald-800' : 'text-slate-700'
                          }`}
                        >
                          {isBroadcast ? 'Village Broadcast' : 'Ticket Update'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {formatTimestampWithTime(item.createdAt)}
                        </span>
                        {isPersonalUnread && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-emerald-700">Unread</span>
                          </>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                      <p className="text-sm text-slate-600 leading-relaxed">{item.message}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.requestId && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isPersonalUnread) {
                              void markRead(item.id);
                            }
                            onOpenRequest(item.requestId);
                          }}
                          className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap"
                        >
                          View Request
                        </button>
                      )}
                      {isPersonalUnread && (
                        <button
                          type="button"
                          onClick={() => void markRead(item.id)}
                          className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-medium text-emerald-800 hover:bg-emerald-100/60 transition-colors whitespace-nowrap"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
