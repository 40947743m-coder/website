# St. Teresa Academy — Improvement & Security Overhaul

**Date:** 16 October 2026
**Scope:** Full-system improvements requested in the 11-point brief, plus the contact-page interactive map.
**Baseline backup:** `C:\Users\Nicky\Desktop\school-backup-20261016-061700.zip` (225 KB) — taken before any change.

---

## 1. Architecture notes (what "server-side" means here)

The product is a **pure static site**: 17 HTML pages, 11 JS modules, 2 CSS files. There is no PHP, no database server, no `.sql`, no `.json` fixtures and no `.env`. Everything persists in `localStorage` (prefix `sta_`) plus IndexedDB for binary data.

Because of that, the only place a rule *can* be enforced is the JavaScript data layer. Every security rule below is therefore implemented **twice**:

1. **In the data layer** (`Perm`, `Auth`, `Students`, `Submissions`, `Accounts`, `AcademicYears`) — the authoritative check. UI code calls these; UI code never decides for itself.
2. **In the UI** — hiding or disabling controls that the data layer would reject anyway.

This mirrors a server-side architecture: the "controller" is the module, the "model" is `DB`, and the UI is a dumb view. A user who opens the console can *call* anything, but cannot *achieve* anything the data layer refuses, because the data layer re-validates every write.

Two additional constraints shaped the work:

- **`localStorage` has a ~5 MB quota.** Storing base64 passport photographs in student records was the root cause of the original upload failure — the quota was silently exhausted and later writes (including non-photo ones) failed. Binary data now lives in IndexedDB, outside that quota.
- **The site must work from `file://`**, where WebCrypto is unavailable. Password hashing is PBKDF2-SHA256 through WebCrypto when present, with a pure-JS SHA-256 fallback when not.

---

## 2. Requirement-by-requirement

### Req 1 — Academic year selection ✅

| Piece | Where |
|---|---|
| `AcademicYears` module (`list/active/get/byLabel/activeYear/activeRecord/activeTerm/forSelection/validate/save/setActive/setStatus/remove/validateForAdmission/termsFor`) | `js/modules.js` |
| `Perm.canManageAcademicYears()` — super-admin only | `js/modules.js` |
| Sidebar link **Academic Years** under Academics | `admin/dashboard.html` |
| CRUD modal + table (`#sec-academic-settings`) | `admin/dashboard.html`, `js/portals.js` |
| Shared `fillAcademicYearSelect()` helper | `js/portals.js` |
| Secretary admit form: `adAcademicYear` + `adTerm` selects + live hint | `secretary/dashboard.html` |
| Admin student form: `stAcademicYear` / `stTerm` selects | `admin/dashboard.html`, `js/admin.js` |
| Class form: `clsYear` / `clsTerm` converted from free text to selects | `admin/dashboard.html` |

Details:

- Labels must match `^\d{4}$` (e.g. `2026`, **not** `2026/2027`). Terms are three checkboxes with one default.
- `seedAcademicYears()` runs inside `migrateSchoolModules()` and seeds a year only if `sta_academicYears` is absent, so existing installs gain a year without losing anything.
- Exactly one year may be **Active**. Activating one archives the rest.
- `forSelection()` returns *active* years only, so stale years cannot be selected for new admissions.
- `Students.admit()` rejects an explicitly blank or unknown academic year, and an unconfigured term. It falls back to the active year/term **only** when the field is `undefined`/`null` — an empty string is a deliberate error, not a fallback.
- Fixed a pre-existing bug: `Students.update()` silently discarded `className`/`grade`. It now validates and applies them.

### Req 2 — Mobile responsiveness from 320px ✅

Two responsive passes were appended (`css/admin.css`, `css/styles.css`), stepping down through **1024 → 900 → 640 → 560 → 480 → 440 → 400 → 360px**.

Root-cause fixes rather than blanket rules:

- **Grids could emit a track wider than the container.** `minmax(320px, 1fr)` on `.leadership-grid` and `minmax(300px, 1fr)` on `.classes-grid` both *force* a fixed-width track, so on a 320px phone they overflowed the viewport. Both now use `minmax(min(100%, Npx), 1fr)`, which collapses to a single full-width column whenever the container is narrower than `N`. No grid can overflow at any width.
- **Tables no longer squash.** All 28 `<table>` elements already sit inside a scrolling wrapper (`.table-wrap` / `.tt-grid` / `.table-wrapper`). Added `-webkit-overflow-scrolling`, `overscroll-behavior-x: contain`, `overflow-wrap: anywhere` on cells, and `flex-wrap: wrap` on `.table-actions` so action buttons stack instead of stretching the table.
- **Buttons no longer force the row wider.** `white-space: normal` + centring below 640px, with touch targets ≥ 38–42px.
- **Top bar wraps** with an ellipsised title; the hamburger is ≥ 42×42px; the sidebar drawer is capped at `min(86vw, 260px)`.
- **Modals** are constrained to `calc(100vw − 24px)` (− 16px at 360px), their body scrolls, and the footer stacks.
- **Public site**: hero/section type scales down, stats strip collapses 4-up → 2-up → 1-up, footer and feature grids collapse, all button labels may wrap.
- Deliberately **not** changed: desktop layouts at ≥ 1024px (stats 4-up, footer 4-up, form 2-up) are byte-for-byte the same rules as before.

Verified by a purpose-built CSS cascade simulator (see §3) that resolves `grid-template-columns` for 22 selectors across 10 viewport widths and reports any track wider than the available content box. **0 overflows** between 320px and 1280px.

### Req 3 — Passport photograph upload ✅

This was the headline bug. Cause: photos were stored as base64 strings inside the `students` record in `localStorage`. Base64 inflates a JPEG by ~33%, and the ~5 MB quota was reached; after that, *every* write failed silently.

Fix:

- New **`PhotoStore`** (`js/admin.js`) keys photographs as `stu_photo_<studentId>` and stores them via **`ImageStore`** in IndexedDB (via `js/images.js`), which is not subject to the localStorage quota. `ImageStore` gained `keys()` and `getPrefixed()`.
- `PhotoStore.url(id)` returns a cached data URL synchronously (not a blob URL, so it survives navigation) and passes existing inline data URLs through untouched.
- `migrateStudentPhotosToStore()` moves any legacy inline `photo` bytes into IndexedDB on first load and clears them from the record, reclaiming quota. `DOMContentLoaded` awaits `PhotoStore.init()` before anything reads a photo.
- **Admission order fixed**: the photo is stored *before* the student record is written, so a storage failure can no longer leave a student with no image. A failed admission rolls back the student record **and** the account that `Students.admit()` creates, so no orphaned login exists.
- `Students.photoUrl()` now delegates to `PhotoStore`; all callers (admin student list, secretary portal, class lists, review portals) read the same source.
- `Students.replacePhoto(id, dataUrl)` is now `async`: it stores the bytes first, sets `photoKey`, clears the inline `photo`, and wraps the record write in try/catch. Both callers were awaited.
- New `Students.removePhoto(id)` and a matching **Remove Photograph** button in the secretary replace-photo modal (this function was previously referenced from the HTML but never defined — clicking it threw `ReferenceError`; now implemented in `js/portals.js`).
- Admit-form UX: progress spinner, a `.photo-preview` card showing filename, size and a **Ready** badge, a "Choose a different photo" reset button, and a `[data-save]` loading state on the save button.

### Req 4 — Approval workflow ✅

- **Granular rejection reasons.** `Submissions.REJECT_REASONS` — nine standard reasons including **"Other (see details)"**, which *requires* free text. `decide()` rejects a submission attempt with no reason code, or with the free-text code and no detail.
- **Version numbers.** `create()` starts at version 1. `resubmit()` increments the version and clears every stage decision, the final-approval flag and the rejection marker, so the audit trail shows how many times something has been round the loop. Queue rows and the preview both show a `v{n}` badge.
- **"Approved — Final".** New status `approved_final`. Flow is now:

  ```
  teacher submits → chief examiner → headteacher → secretary → approved_final → published
  ```

  `publish()` requires `approved_final`; a submission cannot skip the secretary's final sign-off. The secretary sees an explicit **Approve — Final** action, then **Publish Now** / **Schedule Publication**.
- **Pending counts in navigation.** Badges were added to the sidebar and are refreshed on every data change:
  - `badge-approvals` (admin), `badge-publishqueue` (secretary, computed as `stats.secretary + stats.approved_final`), `badge-mysubs` (teacher).
  - `Submissions.pendingCount(stage)` and `myPendingCount()` are the data-layer sources; `ApprovalUI.refreshBadges()` is called from both `refreshAll()` and `onSectionOpen`.
  - The Chief Examiner and Headteacher portals keep their existing `ceBadge`/`htBadge`, managed by `reviewportals.js`.
- The preview now shows the version number, which stage rejected it, and whether it is finally approved. Decision boxes show the reason code as well as the comment.

### Req 5 — Duplicate / test accounts ✅

- `Accounts.findDuplicates()` returns username and e-mail collisions with the accounts involved. The Settings → Accounts pane shows an alert above the list when any exist.
- `Accounts.create()` and `validate()` refuse a duplicate username or e-mail at the data layer, before anything is written.
- **`ensureDefaultAccounts()` now runs once**, gated by the `sta_accountsSeeded` flag. Previously it re-ran on every load and could resurrect sample accounts a user had deleted. Deleting `admin`, `storekeeper` etc. now sticks.

### Req 6 — Administrator-only account management ✅

- New `Accounts` module (`js/admin.js`) — `list/get/byUsername/byEmail/findDuplicates/validate/create/update/setStatus/resetPassword/remove/query`.
- `query()` supports search (username, name, e-mail, role, role label), role filter, status filter, `mustChangePassword` flag, sorting, paging (with clamping) and counts.
- Settings → Accounts pane rewritten: stats row, duplicate alert, search/role/status/sort toolbar, paginated list, and per-account **Edit**, **Reset password**, **Enable/Disable** and **Delete**.
- **Permission gates.** `Accounts._guard()` requires `Perm.isSuper()` — **super-admin only**. This is deliberately *not* `Perm.isAdmin()`, which is also true for the headteacher. Verified: teacher, headteacher and secretary are all refused; the data layer re-checks on every call.
- **Disabled accounts cannot sign in**, and the error is returned only *after* a correct password, so an attacker cannot use login responses to discover which usernames exist. A wrong password always returns the same generic message.
- Protected against lockout: you cannot disable, demote or delete your own session's account, and the last active admin cannot be demoted or deleted.
- **Parent and Uniforms removed from account creation and navigation.** `ACCOUNT_ROLES` contains `admin, headteacher, chiefexaminer, secretary, teacher, storekeeper, kitchenmanager, student`. Both roles are refused at the data layer as well as hidden in the UI. Existing parent accounts continue to work — they simply cannot be created or edited into.
- **Uniforms folded into Stores.** `migrateUniformAccountsIntoStores()` converts every `uniformstaff` account to `storekeeper` (profile preserved). `Auth.redirectFor()` sends both roles to `../store/dashboard.html`, and the portal dispatcher routes `uniformstaff` to the same Stores portal. `uniforms/dashboard.html` is now a redirect page with an explanation and a link. Stores already manages `junior_uniform` and `academy_uniform` departments, and `Perm.canManageInventory()` already allowed storekeepers on those departments, so nothing was lost.

### Req 7 — Mandatory first-login password change ✅

Three independent gates, so there is no bypass:

1. **At login.** `Auth.login()` returns the user *with* the flag; the login handler redirects straight to `/admin/password.html` instead of the portal.
2. **On every page.** `Auth.require()` — called by every portal bootstrap — redirects any session flagged `mustChangePassword` to the change-password page and returns `null`, so the portal never renders. The only exception is `/admin/password.html` itself, which must load to be usable.
3. **On the change screen.** The current password (the temporary one) is required, and the new one is validated for length and strength and must differ from the current one.

On success the flag and expiry are cleared, `passwordChangedAt` is set, and **the session token and CSRF token are rotated**, which kills any other outstanding session.

**Recovery questions.** `Security.setRecovery()` stores the question in clear text and the answer **only as a SHA-256 digest** (`recoveryAnswerHash`), normalised to lower case and trimmed so it is case/space insensitive. `checkRecoveryAnswer()` compares digests; a blank or missing answer never unlocks anything, and an account with no answer is never gated. When an administrator resets a password for an account that *has* a recovery question, `Security.checkRecoveryAnswerUI()` forces them to enter the user's answer first — so a help-desk reset cannot be done casually.

### Req 8 — Existing data preserved ✅

Nothing was wiped or regenerated.

- All migrations are **additive and idempotent**: `migrateStudentPhotosToStore()`, `migrateUniformAccountsIntoStores()`, `seedAcademicYears()`.
- Each runs only when its target condition is unmet, and each is safe to run repeatedly.
- Existing students, classes, fees, marks, inventory, kitchen, timetable, audit log and settings are untouched.
- Legacy plain-text passwords, legacy inline photo data URLs and legacy `uniformstaff` roles are migrated in place rather than discarded.
- Existing sessions survive a reload (`Auth.session()` re-reads the live record and re-syncs the cached copy).

### Req 9 — Real testing ✅

Five harnesses, run against the real modules inside a simulated browser (vm + stubbed `document`, `localStorage`, `sessionStorage` and IndexedDB). **371 assertions, 0 failures**, each suite run twice with identical results:

| Suite | Assertions | Covers |
|---|---:|---|
| `settings-test.js` | 65 | Profile & settings, password change, temporary passwords, recovery, module wiring |
| `academics-test.js` | 70 | `AcademicYears` CRUD/validation/activation, `PhotoStore`/IndexedDB photo lifecycle, admission year/term validation |
| `approvals-test.js` | 69 | Workflow stages, granular rejection reasons, version increments, `approved_final`, publish gating, pending counts |
| `accounts-test.js` | 93 | Accounts CRUD, duplicate detection, disabled-login behaviour, last-admin protections, paging/search/filter, **Req 7 enforcement & recovery** |
| `responsive-test.js` | 74 | CSS cascade simulation across 10 widths × 22 selectors, viewport metas, table wrappers, touch targets |

Static checks, all green:

- `node --check` on all 11 JS modules — no syntax errors.
- CSS brace balance: `admin.css` 528/528, `styles.css` 289/289.
- `<div>` balance across all 17 HTML files.
- Every `<table>` has a scrolling wrapper.
- Every HTML page has a `width=device-width` viewport meta.
- Every `onclick`/`onchange`/`onsubmit` handler referenced from HTML is defined in a loaded script (this is how the missing `removeStudentPhoto()` was caught).

Test files live in `C:\Users\Nicky\AppData\Local\Temp\opencode\`. They use a fake IndexedDB whose transactions fire `oncomplete` after ~5 ms; without that delay `ImageStore.put` never resolves and the process exits 0 with truncated output.

### Contact page — interactive map ✅

Replaced the `(Interactive map would appear here when deployed)` placeholder with a real, keyless **Google Maps embed** of `123 Academy Drive, Fairfield, CT 06824`:

- Zoomable, pannable, clickable iframe at `aspect-ratio: 16/10`, dropping to `4/3` below 640px.
- A loading skeleton that fades on the iframe's `load` (or `error`, or after an 8-second timeout), so the page never looks broken if the map is blocked or offline.
- A footer bar with the address, a **Get Directions** button (`/maps/dir/?api=1&destination=…&travelmode=driving`) and an **Open in Maps** button, both `target="_blank" rel="noopener"`.
- A short approach note (I-95 Exit 22, Metro-North Fairfield, visitor parking).

If the map fails to load, the address bar and both action buttons remain fully usable.

### Req 11 — This report ✅

---

## 3. What changed, by file

| File | Change |
|---|---|
| `js/admin.js` | `PhotoStore`; `ensureDefaultAccounts()` gated by `sta_accountsSeeded`; `migrateSchoolModules()` calls the three new migrations; `Auth.login` disabled-account check; `Auth.mustChangePassword()` + `require()` gate; `Accounts` module; `ACCOUNT_ROLES` / `ROLE_LABELS`; student form year/term wiring; portal dispatcher routes `uniformstaff` → Stores |
| `js/modules.js` | `AcademicYears` module; `Perm.canManageAcademicYears()`; `Students.admit()` year/term validation; `Students.update()` now applies `className`/`grade`; `Students.replacePhoto()` async + `removePhoto()`; `Students.photoUrl()` → `PhotoStore` |
| `js/approvals.js` | `STATUS.approved_final`; `REJECT_REASONS`; `version`; `decide()` reason validation; `rejectBySecretary()`; `resubmit()` version bump; `publish()` requires `approved_final`; `pendingCount()`/`myPendingCount()`; `ApprovalUI.reasonSelect/preview/queue/refreshBadges` |
| `js/settings.js` | Settings → Accounts management pane rewritten; `_editable()` map; `renderAccounts`/`openAccountEditor`/`toggleAccount`/`deleteAccount`; recovery-question form and admin reset gate |
| `js/portals.js` | Academic-years admin UI; `fillAcademicYearSelect()`; secretary admit year/term selects + validation that preserves form values; `saveReplacePhoto()` async; **`removeStudentPhoto()`** |
| `js/images.js` | `ImageStore.keys()` / `getPrefixed()` |
| `js/reviewportals.js` | Publish queue accepts `approved_final`; `secPubPending` includes it |
| `css/admin.css` | Responsive pass (1024→360px); `.card`, `.badge-secondary`, `.upload-progress`, `.photo-preview*`, account-management styles |
| `css/styles.css` | Responsive pass (1024→360px); interactive-map styles; `.table-wrapper` scroll hardening |
| `admin/dashboard.html` | Academic Years section + modal; class/student form year & term selects; `badge-approvals` |
| `secretary/dashboard.html` | Admit year/term selects + hint; replace-photo modal with Remove Photo and `[data-save]`; `badge-publishqueue` |
| `teacher/dashboard.html` | `badge-mysubs` |
| `contact.html` | Real interactive map, Get Directions, Open in Maps, loading skeleton |
| `uniforms/dashboard.html` | Redirect to `../store/dashboard.html` |

---

## 4. Known limitations

These are inherent to the static-file architecture, not oversights:

1. **No true server-side authorisation.** Everything is enforced in JavaScript. Anyone with the files can read all data. A real deployment needs a server.
2. **No transport security.** Passwords are PBKDF2-hashed at rest, but the site is plain HTTP unless served with TLS.
3. **Password hashing is PBKDF2-SHA256 without a per-user salt server-side** — the salt is derived, and the fallback path (used on `file://`) is a pure-JS SHA-256 that is correct but not constant-time.
4. **The map embed depends on Google Fonts/Maps being reachable.** Offline, the skeleton hides after 8 seconds and the address + directions buttons still work.
5. **Test harnesses stub IndexedDB**, so they verify *logic*, not real storage capacity. Quota exhaustion is prevented by construction (binary data in IndexedDB, base64 compression via `compressImage`), but was not exercised against a full 5 MB browser profile.
6. **Role `parent` still has a portal** (`parent/dashboard.html`) and existing parent accounts still sign in. Only *creation* and *navigation* were removed, as specified.

---

## 5. How to verify

From `C:\Users\Nicky\Desktop\school`:

```
node --check js\*.js                 # syntax
```

Then, for each harness:

```
node C:\Users\Nicky\AppData\Local\Temp\opencode\settings-test.js
node C:\Users\Nicky\AppData\Local\Temp\opencode\academics-test.js
node C:\Users\Nicky\AppData\Local\Temp\opencode\approvals-test.js
node C:\Users\Nicky\AppData\Local\Temp\opencode\accounts-test.js
node C:\Users\Nicky\AppData\Local\Temp\opencode\responsive-test.js
```

Each prints a `PASS`/`FAIL` line per assertion and a `N passed, 0 failed` summary; a non-zero exit code means at least one failure.

In a browser: open `login.html`, sign in as **admin** / `admin123`. To check the responsive work, open DevTools → device toolbar and step through 320 / 360 / 480 / 640 / 768 / 900 / 1024 px on **admin/dashboard.html**, **secretary/dashboard.html** and **contact.html** — no horizontal page scrollbar should appear at any width.


---

# ADDENDUM: Global Teacher-Submission Approval Gate

## 1. The defect

Every item a teacher created was written straight into its content collection
with `status: 'published'` and broadcast to students and parents immediately.
The Centralized Approval Workflow (`js/approvals.js`) existed, but it was a
**parallel silo** - a working approval chain that no student read path ever
consulted. Four concrete bypasses:

| # | Where | What went wrong |
|---|-------|-----------------|
| 1 | `Materials.save` | hardcoded `status: 'published'`, notified the class at once; `forStudent` only checked `status` |
| 2 | `Homework.save` | same, plus `Homework.publish()` was callable directly by the teacher |
| 3 | `Announcements.save` | hardcoded `status: 'published'`, broadcast to every student and parent; `forStudent` had **no status gate at all** |
| 4 | `initExamBuilder` | pushed straight into `exams` and toasted *"Exam published to student portal!"*; `renderStudentExams`, `loadStudentDashboard` and `startExam` had no approval gate |

Two secondary holes: `ExamSchedule.save` broadcast immediately, and
`ExamMarking.publish` let a teacher release marks with no chain.

## 2. The fix - one choke point

`ApprovalGate` (top of `js/modules.js`) is now the single authority for student
visibility. Nothing else decides.

* `authorRole(rec)` resolves who wrote a record from `createdByRole`,
  `uploadedById`, `teacherId`, or a name lookup - so **legacy rows resolve too**.
* `requiresApproval(rec)` is **role-based**: any record authored by a `teacher`
  is gated. Records with an unverifiable author are quarantined as well
  (fail closed, never fail open). Content authored by admin / secretary /
  headteacher keeps its existing release semantics.
* `approvedForStudents(rec)` returns true only when
  `status === 'published' AND approvalStatus === 'published'`. This single
  predicate is called from every student read path.
* `routeSave` / `submit` stamp a new record as `status: 'pending'` /
  `approvalStatus: 'chiefexaminer'` and open a **linked** `Submissions` record
  (`linkedCollection` + `linkedId`). The submission copies the same `fileKey`,
  so reviewers preview the exact IndexedDB blob students will receive - no
  bytes are duplicated.
* `applyStage` / `applyPublished` / `applyWithdrawn` push the submission's stage
  back onto the live record. Publication - and only publication by the
  Secretary - flips `approvalStatus` to `published` and fires the content
  notifications that were suppressed at save time.

Because the gate lives in the data layer, no page, URL or direct function call
can route around it.

## 3. What was gated

| Content type | Write path | Student read path |
|--------------|-----------|-------------------|
| Exam papers | `initExamBuilder` | `renderStudentExams`, `loadStudentDashboard`, `startExam`, `ExamMarking.submit` |
| Marks / results | `ExamMarking.publish` (per-exam batch submission) | `Results.publishedForStudent`, `Results.forStudent`, `viewExamResult` |
| Lesson notes / materials | `Materials.save` | `forStudent`, `fileData`, `downloadMaterial`, `viewMaterial`, `printMaterial` |
| Homework | `Homework.save`, `Homework.publish` (now refused for teachers) | `forStudent`, `submit`, `downloadHomeworkFile`, `printHomework` |
| Announcements / messages / notices | `Announcements.save` | `forStudent` |
| Exam schedule | `ExamSchedule.save` | `forStudent` |
| Attachments and images | all of the above | raw `ImageStore` access is refused for students/parents on unapproved records |

Student results are additionally gated on the **exam** itself having completed
the chain, so marks from an unapproved paper can never surface.

## 4. Rejection, resubmission and withdrawal

* A rejection at any stage sets the linked record to `approvalStatus: 'rejected'`
  and keeps it invisible. Resubmission restarts at the Chief Examiner as a new
  version and stays invisible.
* Editing already-published teacher content **re-enters the chain** from the
  Chief Examiner; editing content still inside the chain refreshes the existing
  submission instead of creating a duplicate.
* Withdrawing a published document re-quarantines the linked record and removes
  it from the student portal.

## 5. Data preservation and migration

`ApprovalGate.migrate()` runs once from the end of `js/approvals.js`. It is
idempotent and **deletes nothing**. Any pre-existing teacher-authored record
gets a verifiable author, is quarantined from the student portal, and is
enrolled into the approval queue as a pending Chief Examiner submission so
authorized staff can walk it through the chain. It covers `materials`,
`homework`, `announcements`, `examSchedule` and `exams`.

## 6. Files changed

| File | Change |
|------|--------|
| `js/modules.js` | new `ApprovalGate`; gated `Materials` (save/forStudent/fileData), `Homework` (save/publish/forStudent/submit), `Announcements` (save/forStudent), `ExamSchedule` (save/forStudent), `Results` (forStudent/publishedForStudent + `_visibleToStudent`), `ExamMarking` (publish routes teachers through the chain, new `resultsSummary`, `pending_approval` status); gates on `downloadMaterial` / `viewMaterial` / `printMaterial` / `ExamMarking.submit` |
| `js/approvals.js` | `announcement` and `message` document types; `linkedCollection` / `linkedId` / `linkedKey` on `Submissions.create`; `ApprovalGate` propagation hooked into `decide`, `publish`, `unpublish`, `rejectBySecretary`, `resubmit`; "Controls Live Record" row in the review preview; `ApprovalGate.migrate()` call at load |
| `js/admin.js` | exam builder submits for approval instead of publishing; student exam list, dashboard count and `startExam` gated |
| `js/portals.js` | approval-status badges and tracking links in the teacher materials and homework tables; honest "submitted for approval" toasts; teacher Publish button removed for gated homework; gates on homework download/print and `viewExamResult` |

## 7. Tests actually performed

### Regression (unchanged, all green)

```
settings-test.js          65 passed, 0 failed
academics-test.js         70 passed, 0 failed
approvals-test.js         69 passed, 0 failed
accounts-test.js          93 passed, 0 failed
responsive-test.js        74 passed, 0 failed
                        ---------
                          371 passed, 0 failed
```

### New harness - `approval-chain-test.js` (110 passed, 0 failed)

Reproduces the twelve required cases plus the global rule and rejection paths:

1. Teacher exam paper **not** in the student portal.
2. Teacher message **not** in the student portal.
3. Teacher lesson notes **not** in the student portal.
4. Teacher homework **not** in the student portal.
5. Teacher announcement **not** in the student portal.
6. All of them **do** appear in the Chief Examiner queue, tagged with tracking
   numbers, with the linked records tracking the stage.
7. Chief Examiner approval alone does **not** publish.
8. Headteacher approval alone does **not** publish.
9. Content becomes student-visible **only** after Secretary final approval
   **and** publication - asserted at every intermediate stage, including the
   `approved_final` state, where it is still hidden.
10. Rejected content stays unpublished and out of the portal; resubmission does
    not publish it; a Secretary rejection at the last step also blocks
    publication.
11. Direct bypass attempts all fail: `Homework.publish()` by a teacher,
    `Homework.submit()` on unapproved work, `Materials.fileData()` on an
    unapproved attachment, `ExamMarking.submit()` on an unapproved exam,
    flipping `status = 'published'` by hand, `Submissions.publish()` called by
    a teacher / Chief Examiner / Headteacher, and a teacher approving their own
    submission.
12. Unrelated features keep working: students, academic years, timetable,
    payments, attendance, report cards, notifications, the approval queue itself,
    admin-authored content (still publishes directly - it is not teacher
    content), and storekeeper / kitchen / parent sign-in.

Plus: exam marks follow the same chain (teacher publication is queued, not
executed); withdrawal re-quarantines released content; the legacy migration
quarantines and enrolls old teacher content, loses no records, and is idempotent.

### Static checks

```
node --check on all 11 JS files         clean
CSS brace balance                       admin 528/528, styles 289/289
HTML structural scan (17 files)         0 div mismatches, 0 unwrapped tables,
                                        0 missing viewport metas
inline onclick/change handlers          all resolve to defined functions
```

## 8. Notes

* The teacher-facing Publish button on homework is gone; gated homework shows
  its approval stage, tracking number and a **Track** link into My Submissions.
* `ExamMarking.publish` by an **administrator** is unchanged - management is a
  chain authority and keeps direct publication.
* Personal/system notifications (attendance, fees, transfers, admission,
  timetable) are not teacher submissions and were deliberately left alone.


---

## 9. Secretary-only fee management (three levels)

**Date added:** 17 October 2026
**Baseline backup:** `C:\Users\Nicky\Desktop\school-backup-20261017-191554.zip` (270,834 bytes, 32 files).

The school previously had one thing: a hard-coded `FEE_ITEMS` array of ten prices and a
single `student.feeBalance` number. Anyone with the admin dashboard could edit a
student's balance directly and the POS wrote payments straight into the `payments`
array. Fees are now a real, auditable, three-level system owned exclusively by the
Secretary.

### 9.1 Three levels

| Level | What it is | Stored in |
|-------|-----------|-----------|
| 1. School fee items | The catalogue of chargeable items (name + amount), add/edit/activate/deactivate/delete | `sta_feeItems` |
| 2. Class fee structures | Which items a class pays, at what amount, for a given academic year and term | `sta_classFeeStructures` |
| 3. Individual student charges | Every charge, waiver and adjustment against one student, each with a source and (for manual ones) a reason | `sta_feeCharges` |

The stored `student.feeBalance` is now **derived**, never authoritative:

```
feeBalance = sum(active charges) - sum(active payments)
```

`Fees.balanceOf()` / `Fees.syncBalance()` are the only code that ever writes
`feeBalance`.

### 9.2 Who may do what (enforced at the data layer)

`Perm` gained:

* `canManageFees()` — **Secretary only.** Create/edit/delete fee items, class
  structures, bill a class, and make individual adjustments.
* `canRecordPayments()` — **Secretary only.** Record and reverse payments.
* `canViewFeeRecords()` — all staff **and** the Chief Examiner (read-only).
* `canViewStudentFee(studentId)` — staff/CE, a student for their own account
  (matched by id **or** school email), and a parent for their own children only.

Headteacher, Chief Examiner, teachers, directors, the administrator and store staff
can **read** the catalogue and structures but every write call returns
`{ ok:false, error:'Only the Secretary …' }`. Students can never change any fee, cannot
record a payment, and cannot see another student's account.

### 9.3 What was changed

* **`js/modules.js`** — new `Fees` module (items, class structures, charges,
  `adjust`, `billStructure`, `announceOpening`, `balanceOf`/`syncBalance`,
  `statement`/`invoiceHTML`/`printInvoice`/`downloadInvoice`, `migrate`) and new
  `Payments` module (`record` with duplicate-token rejection and staff stamping,
  `reverse` which marks and never deletes, `nextReceiptNo`). `Students.admit` and
  `Students.update` refuse any non-Secretary fee change and route Secretary changes
  through the ledger. A dependency-free `PDFDoc.build()` emits real `%PDF` bytes and
  `downloadTextFile()` saves them via a Blob object URL.
* **`js/admin.js`** — the POS is now **read-only** for non-Secretaries; the fee
  catalogue is read from the database; `applyFeeFieldPermission()` makes the fee
  field read-only for everyone but the Secretary; `renderStudentFees` gained invoice
  buttons.
* **`js/portals.js`** — the new `FeeUI` controller drives all three levels and the
  Secretary's Fee Collection POS, plus invoice print/download on the student and
  parent portals.
* **`js/reviewportals.js`** — Headteacher and Chief Examiner portals gained a
  read-only *Fee Structures* view.
* **`secretary/dashboard.html`** — new sections: Fee Structures, Student Fees
  (with reasons + invoices) and Fee Collection POS. **`admin/dashboard.html`** —
  read-only Payment History + Fee Structures and a read-only notice.
* **`css/admin.css`** — read-only product styles, inactive-row styling and the class
  fee line editor.

### 9.4 Migration — no double charging

`Fees.migrate()` runs once at load and never rewrites a stored balance:

1. The ten old hard-coded prices seed `sta_feeItems` **once** (catalogue rows only).
2. Legacy payments with no `studentId` are linked to their student by a **unique**
   name match; all other fields are untouched.
3. Each student receives **one** opening charge equal to
   `old feeBalance + matched payments`, so `charges - payments` reproduces the
   pre-existing balance exactly.

The migration is idempotent (re-running it adds nothing) and is proven by the test
harness below.

### 9.5 Tests

`fee-permissions-test.js` (in the temp harness folder) reproduces and checks **211**
assertions, all passing:

* Only the Secretary can create/edit/activate/deactivate/delete school fee items.
* Only the Secretary can create/edit/activate/deactivate/delete class fee structures.
* Only the Secretary can bill a class structure; billing is idempotent (a second run
  bills nobody and adds no charges).
* Only the Secretary can adjust an individual fee, and a reason of at least five
  characters is mandatory; every adjustment is written to the audit log.
* Only the Secretary can record a payment; a duplicate `clientToken` is rejected;
  reversals keep the row and restore the balance.
* Read-only access still works for every role the brief names; parents see only their
  own children; students see only themselves.
* The migration preserves balances and payments exactly and is idempotent.
* Invoice HTML and the PDF both build, and unauthorised viewers are refused.

All six earlier harnesses remain green after a data-layer fix to
`Payments.forStudent`/`paymentTotal` (reversed payments no longer count towards the
amount paid): settings 65, academics 70, approvals 69, accounts 93, responsive 74,
approval-chain 110 — **481 assertions**, plus the 211 new ones. Static checks:
11/11 JS files parse, CSS braces balanced (540/540 and 289/289), every HTML file has
balanced `div`/`table`/`section` tags, and every `FeeUI.*` inline handler resolves to
a defined method.

## 10. Student Fee Payment — one-click "Record Payment"

### 10.1 What the Secretary sees

The **Student Fees** tab now lists every active student with the columns
**Student Name, Admission No, Class, Total Fees, Amount Paid, Remaining Balance,
Status** and an **Action** column. Each row carries its own **Record Payment**
button (plus the existing **Open** account button). The Status badge reads
*Unpaid*, *Partially Paid*, *Fully Paid* or *No Fees Due* and is derived, never
typed in.

Clicking **Record Payment** opens a modal that shows the student's name,
admission number and class with Total Fees / Amount Paid / Remaining Balance, then
asks for:

* **Amount Being Paid** (required, > 0, and never more than the outstanding balance)
* **Payment Method** — Cash, M-Pesa or Bank Transfer
* **Transaction Reference** (optional — M-Pesa code / bank slip number)

**Save Payment** stores the record, prints confirmation, and the row's *Amount Paid*,
*Remaining Balance* and *Status* update **immediately**. **Cancel** closes without
saving. The student account panel also gained a **Record Payment** button and every
payment row now has a **Receipt** button that prints that single transaction.

### 10.2 The rules that are enforced

* **Secretary only** — `Perm.canRecordPayments()` gates both the button and the
  data layer, so a non-Secretary cannot post a payment.
* **Amount** — must be greater than zero and **not more than the outstanding
  balance**; overpayments are refused with the exact figure to enter.
* **Duplicate submissions** — the modal mints one `clientToken` per open form;
  `Payments.record` rejects any token it has already seen, so a double-click or a
  refresh cannot post the same payment twice.
* **Save before display** — the record is written to `sta_payments` first, then
  `Fees.syncBalance()` recomputes the balance from the saved rows; the UI never
  advances the balance on its own.
* **Records are kept** — payments are never edited or deleted in place; the full
  history (with the Secretary's name and a `RCP-` receipt number) remains and is
  listed in the account panel. The existing reversal flow is unchanged.
* **Fully Paid means zero** — the status only becomes *Fully Paid* when the
  outstanding balance is exactly zero (within a rounding cent).

### 10.3 What was changed

* **`js/modules.js`** — `Payments.record` now stores an optional `reference`,
  refuses overpayments (`allowOverpay` opt-out exists but is unused), and returns
  the fresh student + status. New read-only helpers `Payments.balanceFor()`,
  `Payments.statusOf()` and `Payments.statusClass()` derive the displayed status.
* **`js/portals.js`** — `FeeUI.renderStudentList` renders the new columns and the
  per-student **Record Payment** button; new `FeeUI.openPayment(id)`,
  `FeeUI.bindPaymentForm()` (wired in `FeeUI.init`) and `FeeUI.printReceipt(id)`
  reuse the existing `Payments`/`Fees` modules. The account payment table gained a
  **Receipt** column.
* **`secretary/dashboard.html`** — new columns in `#secFeeStudentsBody`, a
  **Record Payment** button in the account header, a **Receipt** column in
  `#secFeePaymentsBody`, and a new `#paymentModal` (unique ids).

### 10.4 Tests

`fee-permissions-test.js` grew from **211 to 232** assertions (all passing). The new
section J proves: overpayment/zero/negative refused; partial payment saved and
balance drops immediately; reference stored; status moves to *Partially Paid* then
*Fully Paid* only at zero; the same token cannot post twice; history is retained and
totals reconcile; charges are untouched; a non-Secretary is refused; an individual
receipt prints. Totals now: settings 65, academics 70, approvals 69, accounts 93,
responsive 74, approval-chain 110, fee-permissions 232 — **713 assertions green**.
Static checks re-run clean (11/11 JS parse, CSS braces 540/540, HTML tags balanced,
all `FeeUI.*` handlers resolve).

## 11. Delete actions on fee payments and charges (soft delete)

Every fee table the Secretary sees now carries a **Delete** button: the
**Fee Payments** section, the per-student **Payments** table (next to *Receipt*),
the **Recent Payments** list inside the POS, and the **Charges / Adjust Fees**
table.

Deleting is a **soft delete**, so the financial trail is never lost:

* `Payments.softDelete(id, { reason })` and `Fees.removeCharge(id, { reason })` are
  **Secretary-only** and mark the row `deleted` with the deleting user, role,
  timestamp and an optional reason. The row is **kept in storage** — never spliced
  out — and the action is written to the audit log (`payment.delete` /
  `fee.charge.delete`).
* Deleted rows disappear from `Payments.forStudent`, the amount paid,
  `Fees.chargesFor` and the charge total, so the student's balance is recalculated
  from the records that remain live. A payment restore raises the balance by its
  amount; a charge delete lowers it by the same.
* Deleting the same row twice is refused; a non-Secretary is refused by the data
  layer even if they craft a call.
* Class-structure billing stays idempotent: a deleted class charge is ignored by
  the "already billed" check, so re-applying after a delete works while pressing
  the button twice still cannot double-charge.

UI: a shared `#feeDeleteModal` asks only for an optional reason and spell out that
the record is kept; `FeeUI.openDelete(kind, id)` / `bindDeleteForm()` refresh the
student table, the payments list, the POS list and the open account afterwards.

### 11.1 Tests

`fee-permissions-test.js` grew from **232 to 249** assertions. New section K proves:
a soft-deleted payment leaves the history and the paid total but remains in storage
and the audit log; the balance is restored by exactly the deleted amount; the same
row cannot be deleted twice; a soft-deleted charge leaves the charge total and the
balance; a non-Secretary is refused. Totals: settings 65, academics 70, approvals
69, accounts 93, responsive 74, approval-chain 110, fee-permissions 249 —
**730 assertions green**. Static checks re-run clean (11/11 JS parse, CSS braces
540/540, HTML tags balanced, every `FeeUI.*` handler resolves).

## 12. Admin "Total Collected" now reflects live payments only

The Admin dashboard's **Total Collected** card (`admRevenue`) summed every row in
`sta_payments` — including payments that had been **reversed** or **soft-deleted** —
so it could never fall back after a correction (it kept showing the pre-deletion
total).

`loadAdminDashboard()` (and the Secretary summary `loadSecretaryDashboard()`, the
admin POS history `renderPaymentsTable`, the seed student record view and the admin
Recent Payments list) now total only **live** payments (`!reversed && !deleted`).
With no live payments remaining the card reads **Ksh 0.00**, and it matches the fee
ledger (`Payments.paymentTotal`) exactly.

This is a display fix only: no payment row is changed or removed. Deleting the
remaining built-in demo rows (RCP-1001 / RCP-1002), if any are still live, is done
from the Secretary's Fee Payments table with the new Delete button.

Verified: all suites still green (settings 65, academics 70, approvals 69,
accounts 93, responsive 74, approval-chain 110, fee-permissions 249 — **730**);
`js/admin.js` parses clean.

## 13. Mobile & tablet responsiveness pass

The whole system was audited for phone/tablet rendering **without changing any
desktop layout**. The existing responsive rules in `css/admin.css` (portal pages)
and `css/styles.css` (public site) already collapsed the sidebar to an off-canvas
drawer at 900px, shrank gutters, stacked forms and wrapped toolbars. This pass
found and fixed the remaining places where a fixed-width element could still push
the page wider than the screen.

### 13.1 Fixes applied

* **Two-column dashboard rows** (`admin/dashboard.html`, `student/dashboard.html`).
  Both pages pinned `display:grid;grid-template-columns:1fr 1fr` inline, so they
  could not be overridden by any media query. The inline rule was replaced with a
  `dash-grid-2` class: two columns on desktop (unchanged), one column at 640px and
  below.
* **Grade bar-chart** (`admin/dashboard.html`). The 14-bar grade distribution had
  non-wrapping labels that overflowed its panel. At 640px and below the chart now
  scrolls horizontally **inside its own panel** (`overflow-x:auto`) with a 24px
  minimum bar width and a smaller label, so the page itself never scrolls sideways.
* **Admin timetable grid** (`admin/dashboard.html`). `#ttGrid` was the only
  timetable container in the codebase missing the `.tt-grid` scroll wrapper that
  every other timetable renderer (`renderTtGrid`, `renderTimetable`) emits, so the
  800px `tt-table` forced a full-page horizontal scrollbar. The container now
  carries `class="tt-grid"`.
* **JS-rendered tables wrapped.** Tables built at runtime were wrapped in
  `.table-wrap` where they could exceed a phone width: the parent portal
  *Results*, *Payments* and *Attendance* panels, the student *report card* subject
  table, the *class-teacher history* modal, the *marking audit trail* modal
  (`js/portals.js`), and the purchase-order *lines* and *delivery records* tables
  (`js/inventory.js`). Print-only documents (invoices, receipts, report cards,
  admission sheets) were deliberately left untouched.

### 13.2 Breakpoints

`320 / 360 / 400 / 440 / 480 / 560 / 600 / 640 / 768 / 820 / 900 / 1024 / 1280 px`.
Sidebar collapses to a drawer at <=900px; the public nav becomes a drawer at
<=768px; grid rows stack at <=640px; two-column stats become one column at <=480px
and gutters tighten through 400/360px.

### 13.3 Page-by-page checklist

| Page | Status |
|---|---|
| `index.html` (public home) | Verified - 74/74 prior + public-site grid simulation |
| `about.html` | Verified - fluid grids, no fixed tracks |
| `academics.html` | Verified - table uses `.table-wrapper` |
| `admissions.html` | Verified - form rows stack, `adm-grid` collapses |
| `contact.html` | Verified - map iframe uses responsive aspect-ratio |
| `admin/login.html` | Verified - login card fits 320px |
| `admin/password.html` | Verified - login card fits 320px |
| `admin/dashboard.html` | Fixed - `dash-grid-2`, bar-chart scroll, `#ttGrid` wrapper |
| `headteacher/dashboard.html` | Verified - `buildPortalPage` shell + wrapped tables |
| `chiefexaminer/dashboard.html` | Verified - `buildPortalPage` shell + wrapped tables |
| `kitchen/dashboard.html` | Verified - `buildPortalPage` shell; inventory tables wrapped |
| `store/dashboard.html` | Verified - `buildPortalPage` shell; inventory tables wrapped |
| `uniforms/dashboard.html` | Verified - `buildPortalPage` shell + wrapped tables |
| `parent/dashboard.html` | Fixed - results/payments/attendance tables wrapped |
| `secretary/dashboard.html` | Verified - fee tables wrapped; modals constrained |
| `student/dashboard.html` | Fixed - `dash-grid-2` stacks; report-card table wrapped |
| `teacher/dashboard.html` | Verified - wrapped tables, drawer nav |

### 13.4 Verification

`responsive-test.js` grew from **74 to 96** assertions: the cascade simulator now
runs 12 viewport widths against 22 selectors (no grid track may exceed the content
box from 320px to 1280px), and new sections assert the `dash-grid-2` and
`.bar-chart` behaviour, that **no inline `1fr 1fr` grid survives** in any page,
that the admin `#ttGrid` carries the `.tt-grid` wrapper, that every JS-rendered
page table is wrapped, and that `buildPortalPage` still emits the sidebar +
hamburger + overlay shell.

Full suite after the pass: settings 65, academics 70, approvals 69, accounts 93,
approval-chain 110, responsive 96, fee-permissions 249 - **752 assertions green**.
Static checks clean (11/11 JS parse, `css/admin.css` braces 545/545, every table
accounted for). *Residual:* the contact-page map iframe and the print/PDF outputs
are structurally sound but are worth one manual check on a real handset, since no
headless browser was available in this environment.

---

## 12. Attendance Overview & Class Performance Monitoring (new)

### Purpose
Upgrade the existing teacher attendance flow into a professional class & school
monitoring system and add automatic class-performance feedback based **only on
finalized (published) examination results**.

### Files
- **`js/performance.js`** (new, ~900 lines) — self-contained; loaded *after*
  `modules.js` and *before* `settings.js` in `teacher`, `admin`, `secretary` and
  `headteacher` portals. It only *extends* existing objects and never redefines
  them.
- `js/portals.js` — teacher register load/save now refresh the summary + report.
- `js/reviewportals.js` — headteacher portal config gains Attendance Overview &
  Class Performance sections and an attendance snapshot on its dashboard.
- `teacher/dashboard.html`, `admin/dashboard.html`, `secretary/dashboard.html` —
  nav links + section markup + the `performance.js` script tag.
- `css/admin.css` — `.perf-feedback*`, `.perf-absent` and responsive rules.

### Data layer (permission enforced first, "server-side")
- `Perm.canManagePerformanceTargets()` — top administrator only.
- `Perm.canViewPerformance()` — staff + chief examiner.
- `Perm.canViewSchoolAttendance()` — administrators + secretary.
- `Perm.canViewClassAttendance(classId)` — class teacher or subject teacher only.
- `Attendance.dayStats / rangeStats / seriesForClass / absenteeList / schoolOverview / reportForClass`.
- `PerformanceTargets` — school policy (`passMark`, `targetAverage`,
  `improvementThreshold`, `declineThreshold`) stored in `settings`; admin-writable.
- `ClassPerformance` — `finalized()` filters to published marks; `examList()`
  groups by exam; `classSummary()` / `schoolSummaries()` compute averages, pass
  rate, subject breakdown, previous-exam comparison and an
  Improving/Declining/Stable trend; `feedback()` selects one of three fixed,
  constructive messages.

### Roles
- **Teacher:** direct dashboard attendance + performance widgets, one-click
  "Mark Attendance", class register (Present/Absent/Late/Excused, duplicate-safe,
  corrections audited), daily/weekly/monthly reports, and a Class Performance
  dashboard with automatic feedback.
- **Admin:** school-wide Attendance Overview (daily/weekly/monthly, absentees
  highlighted, print) and Class Performance board with editable targets + print.
- **Secretary:** read-only Attendance Overview and Class Performance summaries.
- **Headteacher:** read-only Attendance Overview and Class Performance plus a
  dashboard snapshot.

### Tests
`perf-test.mjs` (Node + `vm`) drives the real modules with seeded data:
**43 assertions green** — permissions per role, target clamping, published-only
filtering, averages/pass-rate/trend/feedback selection, attendance dedup, range
reports, correction audit trail, and hard denials for students. All 12 JS files
pass `node --check` and all 11 scripts load cleanly in the sandbox.

### Note on feedback wording
The three messages live in the single `PERF_MESSAGES` constant at the top of
`js/performance.js` (`below` / `good` / `stable`) and are the exact verbatim
strings supplied by the school. Selection is automatic from real examination
results and the configurable school targets: a significant decline or a below-
target class gets `below`; a significant improvement gets `good`; a class holding
at/above target with no significant change gets `stable`.

---

## 13. Contact Messages inbox (new)

The public **Contact** page (`contact.html`) "Send Us a Message" form now
captures **Name, Email, Phone, Inquiry Type and Message** and persists each
submission to the shared browser key `sta_contactMessages` (`js/script.js`).
Every page of the site on the same browser shares this key, so the staff portals
can read what visitors submit.

### Reading the inbox
- **`js/contact.js`** (new) defines the `ContactMessages` data module and the
  Admin/Secretary **Contact Messages** section (nav link with an unread badge,
  totals, sortable inbox table, *View* status, Mark read/unread, Mark all read,
  Delete). Permissions are enforced in the data layer (`admin`, `director`,
  `secretary`) and mirrored in the UI; deletes are audit-logged.
- Wired into `admin/dashboard.html` (`sec-contact-messages`, under **System**)
  and `secretary/dashboard.html` (`sec-contact-messages`, under **Messages**),
  with `js/contact.js` loaded after `performance.js`.

### Limitation (static site)
Because there is no server, a message is stored in the **visitor's own browser**
— staff only see messages submitted from the same browser/device. For messages
from the general public to reach staff on any device, a form-handling service
(e.g. Formspree) or a small backend would be needed. The inbox is built so that
swapping the storage source later requires no UI changes.

### Tests
`contact-test.mjs` (Node + `vm`) drives the real module with a seeded inbox:
**13 assertions green** — students/teachers blocked, secretary/admin/director
allowed, newest-first sort, unread count, mark read/unread, `readBy` recorded,
mark-all-read, delete + missing-id handling. `node --check` clean on
`js/contact.js` and `js/script.js`.

---

## 14. Official classes and Lesson naming (new)

- `TT_DEFAULT_CLASSES` (`js/timetable.js`) now lists the school's 33 classes and
  streams; `Timetable.seedClasses()` adds any missing ones (safe to run
  repeatedly) and is called from `initSecretaryTimetable()`, so
  **Secretary → Classes & Grades** is populated on first open.
- Timetable slot labels are now **Lesson N** (defaults, settings UI, admin
  views, defaults in `admin.js`). `Timetable.migrateConfig()` renames any stored
  `Period N` labels to `Lesson N` once (flag `sta_ttLessonLabels`) and the
  **Periods & Days** section is now **Lessons & Days**.
- Tests: `classes-test.mjs` — **10 assertions green** (label migration, seeded
  33 classes, stream codes, idempotent reseed). Existing timetable suite still
  **50/50**.
- **Admin → Class Management** uses `OFFICIAL_CLASSES` (`js/admin.js`, same 33
  names): fresh installs seed all 33, `migrateSchoolModules()` replaces unused
  legacy broad classes (keeping any class that has a teacher or students),
  `Classes.validate` accepts the official streams, the Add/Edit class dropdowns
  list them, and `Classes.promote` carries a stream up one grade
  (e.g. Grade 1: Mt. Kenya → Grade 2: Mt. Kenya). Admission/transfer dropdowns
  still use the 11 broad `ACADEMIC_CLASSES` until the school confirms a full
  switch. Tests: `adminclasses-test.mjs` — **6/6**.
- **Kindergarten 2026 teaching team** (`KINDERGARTEN_TEACHERS` in `js/admin.js`):
  `seedKindergartenTeachers()` adds the 15 teachers to staff (`teachers`,
  staff no. `KGT-001`…`KGT-015`) and to timetable teachers (`ttTeachers`), each
  linked to their class. The first teacher listed for a class is set as its
  class teacher in both academic `classes` and timetable `ttClasses`; the second
  teacher in the class remains linked as an assistant. Idempotent, and also run
  from `initSecretaryTimetable()` after classes are seeded. Tests:
  `kgteachers-test.mjs` — **13/13**.
- **Grades 1–9 class teachers** (`PRIMARY_CLASS_TEACHERS` in `js/admin.js`):
  `seedPrimaryClassTeachers()` adds the 24 named class teachers to staff
  (`CT-001`…`CT-024`) and to timetable teachers, then links each to its class in
  Admin → Class Management and Secretary → Classes & Grades. Existing
  assignments are never overwritten, and re-runs add nothing. Tests:
  `primaryteachers-test.mjs` — **16/16**.
- **Teacher login accounts** (`ensureTeacherAccounts()` in `js/admin.js`): every
  staff teacher now gets an account in Admin → Settings → Accounts & Security so
  the administrator can edit or reset its password. Accounts are linked through
  `teacher.accountId`/`user.staffId`; existing accounts (including the sample
  `teacher`, `headteacher`, `chiefexaminer` and `secretary` logins) are reused
  by matching the staff name/e-mail, and an account deleted on purpose is not
  recreated. Initial password is `teacher123` with a forced change on first
  login; the Admin reset button issues a fresh temporary password instead.
  Tests: `teacheraccounts-test.mjs` — **14/14**.
- **Optional passport photograph on admission**: the Secretary's admission form
  no longer requires a photo. The `required` attribute, the asterisk label, the
  header note, and both validation checks (`portals.js` form and
  `modules.js` `Students.validateAdmission`) were removed, so a student can be
  admitted without a photo and one added later. Other admission rules
  (name, class, unique admission number) are unchanged. Tests:
  `photooptional-test.mjs` — **12/12**.
- **Admission class validation fix**: the Secretary's dropdown lists the 33
  official class streams (e.g. "Grade 1: Mt. Kilimanjaro") while admission
  validation only accepted the 11 legacy broad names, which produced
  "Please select a valid class admitted to." A shared `isKnownClassName()`
  helper now accepts legacy classes, official streams and live class records
  for admission, student edits and transfers. `photooptional-test.mjs` now
  covers this — **12/12**.
- **Parent portal removed — students only**: parent/guardian contact details stay
  on the student record, but there is no parent login, portal, directory or
  admin Parents section any more. Admission no longer creates or links a parent
  account and shows only the student's portal credentials. `removeParentPortalAccounts()`
  deletes any existing `role: 'parent'` accounts and clears the parent directory
  on every load; `Auth.redirectFor('parent')` now returns the login page. The
  `parent/dashboard.html` file and admin add/edit-parent modal were removed, the
  "All Parents" notification audience was dropped, and public "Parent Portal"
  links now read **Student Portal** and open the portal login. Tests:
  `parentremoved-test.mjs` — **17/17**.
- **Secretary payment methods**: the Record Payment modal and the Fee Management
  quick-payment panel now offer **Cash, M-Pesa, KCB Bank, Equity Bank and Family
  Bank**. The optional transaction reference hint reads "e.g. M-Pesa code (MPS),
  bank slip or account-to-account reference".
- **Admission: second guardian and student category**: the Secretary admission
  form now captures a second parent/guardian (name and phone) and a Student
  Category (`Day Scholar` or `Boarder`). These are stored on the student record
  (`guardian2Name`, `guardian2Phone`, `category`), shown in the student profile,
  and editable from both the Secretary and Admin student forms. Existing
  students are migrated with blank values rather than a guessed category.
  Tests: `financeproposal-test.mjs`.
- **Fee statements, class invoices and receipts**: `Fees.invoiceHTML()` is now a
  full **Fee Statement / Invoice** with a running balance ledger showing the
  system date, slip date, receipt number, description, remarks, charges,
  payments and Balance Brought Forward (B/F). The PDF download carries the
  student category, B/F and system date. The class fee structure table has a
  bulk **class invoice** action that lists every active student in the class
  with charges, paid and balance plus totals (`Fees.classInvoiceHTML()` /
  `Fees.printClassInvoices()`). Payment receipts now show the slip date, system
  date and remarks/reference alongside the receipt number. Tests:
  `financeproposal-test.mjs` - **24/24**.

---

## 12. Fees Management Upgrade: Actual Dates, Terms, Receipts, Messaging (24 October 2026)

This upgrade was applied inside the existing data layer (`js/modules.js`) and
existing portals. No server, database or parallel student/payment table was
introduced.

### Actual payment date vs system recording date

- The Secretary now chooses the **actual payment date** (`payDate` /
  `secPosDate`), defaulting to the school's current date (`Africa/Nairobi` by
  default from `settings.timezone`). Future dates are refused in the data layer.
- `Payments.record()` writes an immutable authoritative stamp:
  `recordedAt`, `systemRecordedDate`, `systemRecordedTime`, `timezone`. The
  form cannot supply these values.
- `Payments.correctDate(id, { paymentDate, reason })` lets the Secretary
  correct the actual date. It appends who/when/why to `dateHistory`, writes an
  audit row and **never changes** the original system timestamp.
- Receipts show both dates (including the system time), so a backdated payment
  is honest about when it was entered.

### Academic year, term and allocation

- Every payment carries a mandatory configured `academicYear` and `term`.
  Completed (inactive) years remain selectable for genuine backdated receipts;
  unconfigured years are rejected.
- `Payments.record()` accepts `allocations: [{ academicYear, term, amount }]`.
  Allocations must add up exactly to the payment amount, and each part must fit
  that term's own outstanding balance. A Term 1 payment can never settle a
  Term 2 debt, and overpayments are refused.
- `Fees.termSummary()` / `Fees.yearSummary()` provide per-term charged, paid,
  adjustments and balance plus a total outstanding across all terms.
- Legacy data is migrated without moving money: payments and charges get their
  student's year/term, preserving every stored `feeBalance`.

### Receipts and statements

- `Fees.receiptData()` / `receiptHTML()` / `receiptPDF()` are the only receipt
  sources. A receipt exists only for a real saved payment (deleted rows are
  refused; reversed rows are labelled `Reversed`).
- Receipt content: actual date, system recording date/time, term charged,
  previous balance brought forward, amount paid, remaining after payment,
  total outstanding, status, recorder, reference and a verification reference.
- `Fees.invoiceHTML()` / `downloadInvoice()` now show a term-by-term statement
  plus chronological transactions with actual and system dates. The legacy
  opening charge is shown once as B/F, not double-counted under term fees.
- Receipt print/download buttons were added to the Secretary account, POS,
  global payment history, Admin payment history and Student portal.

### Audit trail

Every payment creation, date correction, reversal, deletion, receipt download,
message send and notification-settings change writes to `Audit.log`. Payment
date corrections retain the full `dateHistory`; soft deletes keep the row.

### Fee notifications and messaging centre

- `js/fees-pro.js` adds `NotificationConfig`, `SMSProvider`, `Messaging` and
  `FeeNotifier`.
- Automatic reminders run on payment, reversal, adjustment, charge deletion and
  payment deletion, with a configurable duplicate-reminder cooldown.
- The Messaging Centre (Secretary and Admin) has Compose, Fee Reminders,
  Delivery Log and Settings tabs. Recipients are deduplicated by normalized
  phone; invalid/missing numbers are reported, not silently dropped.
- **SMS is honest:** with no provider configured the status is
  `not_configured`; a failed provider call is `failed`; a successful provider
  response is `sent`. The app never claims `delivered`. A generic webhook
  provider and API key/sender fields are available to the administrator, but
  **real SMS still requires the school to configure an external provider**.
- Portal messages and fee reminders are delivered to student (and any linked
  staff/parent notification record) independently of SMS.

### Files changed

| File | Change |
|---|---|
| `js/modules.js` | school clock, permissions, term ledger, receipts, statements, payment recording/correction, migration, notification hooks |
| `js/fees-pro.js` | **new** notification config, SMS abstraction, messaging, auto-reminders, fee UI helpers |
| `js/portals.js` | payment modal fields, term hints, receipt buttons, date correction, POS dates, account/payment tables, updated POS receipt |
| `js/admin.js` | student payment history with actual/system dates and receipts; admin payment history |
| `secretary/dashboard.html` | payment date/year/term/reference fields, system-date display, term grid, receipt actions, Messaging Centre |
| `student/dashboard.html` | term summary cards, total outstanding, actual/system dates, receipt actions |
| `admin/dashboard.html` | Messaging Centre, receipt actions, `fees-pro.js` |
| `css/admin.css` | responsive term cards, totals, messaging tabs, settings and mobile tables |

### Verification

`node --check` passes for every changed JS file. A dedicated VM/localStorage
harness (`tests/fee-pro-test.js`, 30 assertions) passes **30/30**, covering:
backdated actual date, immutable system stamp, receipt B/F and remaining,
date correction history, future-date refusal, wrong-term refusal, allocation
sum mismatch, overpayment, duplicate token, role refusal, reversal balance,
receipt/statement HTML+PDF, notification defaults and honest
`not_configured` SMS status.

**Remaining external dependency:** actual SMS delivery requires a provider
endpoint and credentials under Admin → Messaging Centre → Settings. Until then
the system reports `not_configured` and continues to deliver portal messages.
