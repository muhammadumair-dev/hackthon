# HCM Lite

AI-assisted Human Capital Management for the Saylani Hackathon. This monorepo contains a React/Vite frontend and an Express/Mongoose backend. The MongoDB database starts empty; there is no seed or demo data.

## Stack

- Frontend: React, Vite, Tailwind CSS, React Router, Axios, Recharts
- Backend: Node.js, Express, Mongoose, MongoDB, Zod, bcryptjs, JWT
- AI: Gemini function calling from the backend only (`AI_API_KEY`)
- Production deployment: frontend and serverless Express backend on Vercel; MongoDB Atlas

Use Node.js 20 or newer.

## Local setup

1. Start a local MongoDB replica set (transactions are required), or create a MongoDB Atlas database.
2. In `backend/`, copy `.env.example` to `.env` and set:
   - `MONGO_URI` to the MongoDB connection string
   - `JWT_SECRET` to a private random string of at least 32 characters
   - `FRONTEND_URL` to the frontend origin, usually `http://localhost:5173`
   - `PORT` to `5000` locally (Vercel supplies this automatically)
   - `AI_API_KEY` to a Gemini key for AI features; other app modules work without it
3. Start the backend:

   ```powershell
   cd backend
   npm install
   npm run dev
   ```

4. In a second terminal, configure and start the frontend:

   ```powershell
   cd frontend
   Copy-Item .env.example .env
   npm install
   npm run dev
   ```

   Set `VITE_API_URL=http://localhost:5000` in `frontend/.env` for local use.
5. Open `http://localhost:5173`. On an empty database, the first-run setup page creates the company and first Admin. No default login exists.

## First Admin

On first launch, submit company name, Admin name, email and a strong password on `/setup`. The setup operation is allowed only while no user exists. Keep the Admin credentials private. `ADMIN_EMAIL` and `ADMIN_PASSWORD` are optional reserved placeholders; current first-run creation is through the setup page.

HR accounts are created by Admin. HR registers employee accounts. Each receives a one-time temporary password and must change it on first sign-in.

## AI configuration

Set `AI_API_KEY` only in `backend/.env` locally or the backend deployment environment. Never add it to frontend variables or commit `.env`. AI requests use server-side role and employee scope; AI suggestions do not write HR data.

## Tests and checks

```powershell
cd backend
npm run test:integration

cd ..\frontend
npm run lint
npm run build
```

The integration suite starts a temporary MongoDB replica set and uses the real Express app and database operations.

## Vercel deployment

### Backend

- Create a Vercel project connected to this repository and set root directory to `backend`.
- Vercel detects the Express app exported from `backend/src/index.js`; do not set a custom build command.
- The `src/index.js` serverless entry exports the same Express app used locally and does not call `listen()`.
- Set the backend environment variables below in Vercel Project Settings.
- `backend/vercel.json` sets a 60-second maximum duration and includes PDFKit font/data assets. Confirm the selected Vercel plan supports that duration.

### Frontend

- Import the repository and set root directory to `frontend`.
- Build command: `npm run build`
- Output directory: `dist`
- Set `VITE_API_URL` to the deployed backend origin without a trailing slash.
- `frontend/vercel.json` rewrites application routes to `index.html`.

### Environment variables

Backend (Vercel project root: `backend`):

| Variable | Required | Value |
| --- | --- | --- |
| `MONGO_URI` | Yes | MongoDB Atlas connection string; database transactions require a replica set |
| `JWT_SECRET` | Yes | Private random value of at least 32 characters |
| `FRONTEND_URL` | Yes | Exact allowed frontend origins, comma-separated; include production and any preview Vercel URLs |
| `PORT` | Platform | Vercel supplies this; local server defaults to 5000 |
| `AI_API_KEY` | Optional | Gemini key; configure only on the backend |
| `ADMIN_EMAIL` | Optional | Reserved; create the first Admin at `/setup` |
| `ADMIN_PASSWORD` | Optional | Reserved; create the first Admin at `/setup` |

Frontend (Vercel project root: `frontend`):

| Variable | Required | Value |
| --- | --- | --- |
| `VITE_API_URL` | Yes | Public deployed backend origin; local `.env.example` uses `http://localhost:5000` |

### MongoDB Atlas

- Create a database user and database; use the Atlas connection string as `MONGO_URI`.
- Configure Atlas network access for Vercel Functions. For tighter access, use Vercel Secure Compute/static egress where available; only use a broad allow-list after reviewing the security trade-off.
- No sample documents are inserted. First-run setup creates the company and Admin.

## Five-minute demo

1. Open the empty deployment and create the company and Admin.
2. Configure office settings, department, designation, leave types and a holiday.
3. Create an HR login, sign in as HR, and change the temporary password.
4. Register two employees; show their one-time passwords and first-login password change.
5. As Employee, check in/out, review attendance, submit leave and show the balance.
6. As HR, approve a correction and leave, then prepare a payroll draft.
7. As Admin, review analytics and audit feed, post an announcement and finalize payroll.
8. As Employee, show the payroll notification, finalized payslip, dashboard and AI assistant.

## Functionality status

Authentication/setup, organization configuration, employee directory/import/export, attendance/corrections, leave/notifications, payroll, role dashboards, Gemini assistant, audit log and announcements are implemented. Run the integration, lint and build checks before a live judging demo. Known limits include no camera attendance, attrition-risk scoring, absence anomaly detection, late-penalty policy, dark mode or PWA; these are challenge bonus items, not baseline behavior.
