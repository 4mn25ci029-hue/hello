# GramSetu Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Identity & RBAC Integrity**:
   - No user may self-assign `admin` or `authorized` privileges. Only an existing Administrative Staff user (verified bootstrapped admin or holder of `/admins/{uid}`) can write to `/admins/{uid}`, `/authorizedStaff/{uid}`, or elevate `roleLabel` on `/users/{uid}`.
   - All write operations mandate `request.auth.token.email_verified == true`.
2. **PII Isolation (Split Collection)**:
   - `/users/{userId}` stores only non-PII public directory fields (`uid`, `displayName`, `ward`, `roleLabel`, `isDirectoryVisible`).
   - `/users/{userId}/private/{docId}` stores `email`, `phone`, and `address`. Reads are strictly restricted to `request.auth.uid == userId` or `isAdmin()`. List queries are unconditionally denied (`allow list: if false`).
3. **Service Request Integrity & Terminal Locking**:
   - Villagers can only create requests with `reporterUid == request.auth.uid`, `status == 'Submitted'`, and `estimatedBudget == 0`.
   - Once a request reaches terminal status `'Closed'`, non-admin users (including Authorized Officers) are strictly blocked from mutating it. Only `isAdmin()` can override a closed request.
   - `trackingCode`, `reporterUid`, `createdAt`, and `visibility` are immutable after creation.
4. **Master Gate Relational Integrity**:
   - Every document in `/serviceRequests/{requestId}/updates/{updateId}` must verify that the parent `/serviceRequests/{requestId}` document exists and that `requestId` matches the path parameter.
5. **Notification Privacy & Scoped Broadcasts**:
   - Only `isAdmin()` can broadcast village-wide notifications (`recipientUid == 'all'`).
   - Users can only list notifications where `resource.data.recipientUid == request.auth.uid` or `resource.data.recipientUid == 'all'`.
   - Recipients updating their notification may modify ONLY `['isRead']`.
6. **Temporal Integrity**:
   - `createdAt` must equal `request.time` on creation; `updatedAt` must equal `request.time` on creation and update.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Self-Assigned Admin Role**: Unprivileged user writes `{ uid: "u1", role: "admin", grantedBy: "u1", designation: "Fake Admin", createdAt: serverTimestamp() }` to `/admins/u1`. Expected: `PERMISSION_DENIED`.
2. **RoleLabel Privilege Escalation**: Unprivileged user creates `/users/u1` with `roleLabel: "Administrative Staff"`. Expected: `PERMISSION_DENIED`.
3. **Unverified Admin Email Spoof**: User with `email: "laharbalakrishnagowda@gmail.com"` and `email_verified: false` attempts to publish `/monthlyReports/2026-11`. Expected: `PERMISSION_DENIED`.
4. **Cross-User PII Read**: Authenticated citizen `u2` calls `get` on `/users/u1/private/contact`. Expected: `PERMISSION_DENIED`.
5. **PII Collection Scraping**: Authenticated citizen calls `list` on `/users/u1/private`. Expected: `PERMISSION_DENIED`.
6. **Shadow Field Injection on Service Request**: Villager submits `/serviceRequests/req1` with extra ghost field `isApproved: true`. Expected: `PERMISSION_DENIED`.
7. **Identity Spoofing on Service Request**: User `u2` creates `/serviceRequests/req2` with `reporterUid: "u1"`. Expected: `PERMISSION_DENIED`.
8. **State Shortcutting by Citizen**: Citizen creates `/serviceRequests/req3` with `status: "Resolved"` or updates their own request's `status` to `"Resolved"`. Expected: `PERMISSION_DENIED`.
9. **Terminal State Violation**: Authorized Officer attempts to update a `/serviceRequests/req4` whose existing status is `"Closed"`. Expected: `PERMISSION_DENIED`.
10. **ID Poisoning Attack**: User attempts to create `/serviceRequests/` with an invalid path ID containing spaces/slashes or >128 characters. Expected: `PERMISSION_DENIED`.
11. **Value Poisoning on Notification Read Toggle**: Citizen updates `/notifications/n1` with `{ isRead: true, message: "Hacked notice" }`. Expected: `PERMISSION_DENIED`.
12. **Unauthorized Village Broadcast**: Public citizen creates `/notifications/n2` with `recipientUid: "all"`. Expected: `PERMISSION_DENIED`.
