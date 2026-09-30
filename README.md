# Kebbi Clinic Hospital Management System

Two **separate frontend applications** sharing **one professional layered backend** (Express + MongoDB + Socket.IO + Mailtrap email).

```
                        KEBBI CLINIC BACKEND  (backend/)
                        config · models · services
                        controllers · routes · validators
                                     |
                ---------------------------------------------
                |                                           |
         Hospital Staff App                          Admin App
         (hospital-app :5173)                        (admin-app :5174)
         React + TS + Vite                           React + TS + Vite
```

## Run everything

```bash
# 1. Backend — http://localhost:4000
cd backend && npm install && npm run dev

# 2. Hospital staff app — http://localhost:5173
cd hospital-app && npm install && npm run dev

# 3. Admin app — http://localhost:5174
cd admin-app && npm install && npm run dev

# End-to-end smoke test (backend running):
cd backend && node test-journey.js
```

Demo accounts (seeded automatically, password `password`): `admin` (Super Admin), `admin2` (Hospital Administrator), `records_officer`, `dr.ahmed`, `nurse_aisha`, `lab_sci`, `pharm_chika`, `acc_tunde`, `rad_sam`.

## Backend architecture (`backend/src/`)

```
src/
├── config/        env.js (validated config, fail-fast in prod) · db.js (Mongo, counters, settings cache)
├── models/        one Mongoose schema per entity + index.js registry
├── services/      ALL business logic (patient, visit, nursing, pharmacy, finance,
│                  staff, settings, dashboard, activity, audit, notification,
│                  email ← Mailtrap, storage ← Cloudflare R2)
├── controllers/   thin HTTP adapters over services
├── routes/        Express routers per domain, mounted by routes/index.js
├── validators/    express-validator schemas for every mutating endpoint
├── middleware/    auth (JWT + capability RBAC) · validate · upload · realtime · error
├── sockets/       Socket.IO hub — role rooms, live `data.changed` fan-out
├── seed/          demo staff, patients, inventory, settings
└── utils/         datetime · clean · asyncHandler
```

Request flow: `route → validators → auth/permission middleware → controller → service → models`. Services never touch `req`/`res`; controllers never contain business logic.

### Validation errors

Mutating endpoints return `422` with `{ error, details: [{ field, message }] }` — consistent shape for both frontends.

## Email via Mailtrap

1. Copy your API token from [mailtrap.io](https://mailtrap.io) → **Settings → API Tokens**.
2. Set `MAIL_API_TOKEN` (and `MAIL_FROM`) in `backend/.env` — no SMTP host/username/password needed.
3. Emails go out through Mailtrap's Email Sending API (the sending domain must be verified in Mailtrap). With no token configured, emails are logged to the console instead. SMTP (`MAIL_USER`/`MAIL_PASS` via Nodemailer) still works as a fallback.

Transactional emails implemented in `services/email.service.js`: staff welcome (with temporary password), password reset, patient registration confirmation, wallet receipts, dispensing receipts, lab/radiology result-ready, low-stock alerts. With no credentials configured, emails are logged to the console instead — the app never breaks because of email.

## Real-time

Every successful mutation broadcasts `data.changed` over Socket.IO to both apps (role rooms included), so the Hospital App and Admin App always mirror the database live. Same events as before: `activity.new`, `notification`, `permissions.changed`, `staff.updated`, `staff.roleMoved`, `auth.userOnline`.

## Frontends

- `hospital-app/` — role-based operations app: register patients (permanent `KBC-XXXXXX` ID), start visits, vitals, consultations (labs + prescriptions), laboratory/radiology result uploads, pharmacy dispensing with wallet/cash/transfer/POS, accounting, admissions, role notifications.
- `admin-app/` — management app: dashboards, patient 360° records, staff accounts, role permission matrices, audit log, reports, settings.
- Both talk to the backend via `src/api.ts` (`VITE_API_URL` env var overrides the default `http://localhost:4000`) and use the Vite dev proxy as a fallback. CORS is whitelist-based (`CORS_ORIGINS` in `backend/.env`).

## Golden rule encoded everywhere

One permanent Patient ID → visits → department activities → staff → timestamp. Returning patients always get a **new visit**, never a duplicate patient record.
