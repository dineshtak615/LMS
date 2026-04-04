# LMS (Learning Management System)

A full-stack, multi-tenant LMS platform with role-based access for `super_admin`, `admin`, `trainer`, `student`, and `finance`.

## What This Project Includes

- Organization self-registration (creates organization + admin account).
- Super admin console for platform-wide organization/user oversight.
- Admin tools for users, students, trainers, courses, assignments, enrolments, payments, and library.
- Trainer and student assignment workflow (submit + grade).
- Course media support (video, PDF, thumbnail), served from uploads.
- Payment management with manual entries and Razorpay student checkout flow.
- Analytics and CSV exports.

## Tech Stack

- Backend: Node.js, Express, MongoDB (Mongoose), JWT auth, Multer uploads.
- Frontend: Next.js 16 (App Router), React 19, TypeScript, Axios.
- Database: MongoDB Atlas.

## Roles

- `super_admin`: Platform owner. Manages organizations, plans, users, activity logs.
- `admin`: Organization admin. Manages org data and all operational modules.
- `trainer`: Manages assigned course/assignment workflows.
- `student`: Enrols, learns, submits assignments, interacts with course engagement.
- `finance`: Reads finance-related views and dashboards.

## Project Structure

```text
LMS/
  backend/              # Express API + MongoDB models/controllers/routes
    config/
    controllers/
    middlewares/
    models/
    routes/
    scripts/
  nextjs/               # Next.js frontend (App Router)
    app/
    components/
    context/
    services/
  uploads/              # Runtime file uploads
```

## Prerequisites

- Node.js 20+ and npm.
- MongoDB Atlas cluster and database user.
- (Optional) Razorpay test keys for online payment endpoints.

## Environment Setup

### Backend (`backend/.env`)

1. Copy example file:

```powershell
cd backend
Copy-Item .env.example .env
```

2. Update values:

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | No | `development` / `production` / `test` (default `development`) |
| `PORT` | No | API port (default `5000`) |
| `CLIENT_URL` | No | Comma-separated allowed frontend origins |
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret used to sign JWT tokens |
| `JWT_EXPIRES_IN` | No | Token expiry (default `7d`) |
| `RAZORPAY_KEY_ID` | No | Needed for Razorpay order/payment verification |
| `RAZORPAY_KEY_SECRET` | No | Needed for Razorpay order/payment verification |
| `TRUST_PROXY` | No | Proxy hops value when behind load balancer |
| `SYNC_INDEXES_ON_BOOT` | No | Set `true` to force index sync on boot |
| `SUPER_ADMIN_EMAIL` | For seed script | Used by `createSuperAdmin` script |
| `SUPER_ADMIN_PASSWORD` | For seed script | Used by `createSuperAdmin` script |
| `SUPER_ADMIN_NAME` | For seed script | Used by `createSuperAdmin` script |

### Frontend (`nextjs/.env.local`)

1. Copy example file:

```powershell
cd ../nextjs
Copy-Item .env.example .env.local
```

2. Set API URL:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

## Install Dependencies

From repository root:

```powershell
cd backend
npm install
cd ../nextjs
npm install
```

## Run Locally

Start backend:

```powershell
cd backend
npm run dev
```

Start frontend in another terminal:

```powershell
cd nextjs
npm run dev
```

Open:

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:5000/api/health`

## Create Super Admin (Step-by-Step)

Use this when you want platform-level access to `/super-admin`.

1. Ensure backend `.env` has these keys filled:

```env
MONGO_URI=...
JWT_SECRET=...
SUPER_ADMIN_EMAIL=admin@example.com
SUPER_ADMIN_PASSWORD=StrongPassword123
SUPER_ADMIN_NAME=Super Admin
```

2. Run the seed script:

```powershell
cd backend
npm run seed:super-admin
```

3. Expected result:

- If new user: script prints `Super admin created successfully`.
- If already exists: script prints `Super admin already exists: <email>`.

4. Login from UI:

- Go to `http://localhost:3000/login`.
- Use `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`.
- You should be redirected to `/super-admin`.

## API Modules

All APIs are under `/api`.

- `/api/auth`
- `/api/organizations`
- `/api/super-admin`
- `/api/students`
- `/api/trainers`
- `/api/courses`
- `/api/assignments`
- `/api/enrolments`
- `/api/payments`
- `/api/library`
- `/api/dashboard`
- `/api/analytics`

Public routes:

- `GET /api/health`
- `GET /api/courses/public/popular`

## Uploads

Backend creates and serves upload directories automatically:

- `uploads/videos`
- `uploads/pdfs`
- `uploads/library`
- `uploads/thumbnails`
- `uploads/assignments`
- `uploads/submissions`

Served from: `/uploads/*`

## Scripts

Backend (`backend/package.json`):

- `npm run dev` - start API with nodemon.
- `npm start` - start API with node.
- `npm run seed:super-admin` - create one `super_admin` user from `.env`.

Frontend (`nextjs/package.json`):

- `npm run dev` - start Next.js dev server.
- `npm run build` - create production build.
- `npm run start` - start production server.
- `npm run lint` - run ESLint.

## Troubleshooting

- MongoDB Atlas connect error:
  - Add your current client IP in Atlas Network Access.
  - Ensure Atlas cluster is running.
  - If password has special characters (for example `!`), URL-encode them in `MONGO_URI` (example `!` -> `%21`).
- CORS blocked:
  - Add frontend URL to `CLIENT_URL` in backend `.env`.
  - Multiple origins must be comma-separated.
- `401 Invalid token`:
  - Ensure frontend is sending `Authorization: Bearer <token>`.
  - Verify `JWT_SECRET` matches the secret used to issue token.
- Razorpay endpoints return config error:
  - Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.

## Security Note

- Never commit real `.env` files or production credentials.
- Rotate any credential that was shared publicly.
