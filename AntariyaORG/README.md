# Antariya

The ultimate premium marketplace for embroidery designs, industrial threads, fabrics, and machine accessories in India.

## Core Features

- **AI Customization Studio**: An interactive interface where users can select base garments (like hoodies or blouse pieces) and preview embroidery designs on them using Genkit-powered AI visualization.
- **Product Marketplace**: A comprehensive catalog for browsing and searching digital embroidery assets and physical supplies.
- **Personalized Recommendations**: AI-driven suggestions based on user browsing history and past purchases.
- **Secure Authentication**: Google OAuth login with user persistence in MongoDB via Express API.
- **Dynamic Portals**: Real-time dashboards for managing orders and digital downloads.

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with [Shadcn UI](https://ui.shadcn.com/)
- **Backend API**: [Express.js](https://expressjs.com/) (Node.js)
- **Database**: [MongoDB Atlas](https://www.mongodb.com/atlas/database)
- **AI**: [Genkit](https://firebase.google.com/docs/genkit) with Google Gemini
- **Language**: TypeScript

## Project Structure

- `src/` -> Next.js frontend
- `backend/` -> Express backend, MongoDB connection, OAuth user storage

## Environment Setup

Create one env file for each app:

1. Frontend env:
    - Edit `frontend/.env`
    - Fill:
       - `NEXT_PUBLIC_API_BASE_URL`
       - `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
       - `NEXT_PUBLIC_SITE_URL`
       - `NEXT_PUBLIC_RAZORPAY_KEY_ID`
       - `OPENAI_API_KEY`

2. Backend env:
    - Edit `backend/.env`
    - Fill:
     - `MONGODB_URI`
     - `JWT_SECRET`
     - `FRONTEND_URL`

## How To Create MongoDB Database (Atlas)

1. Open MongoDB Atlas and create account/sign in.
2. Create a new project (example: `StitchMart`).
3. Create a new cluster (free tier is fine).
4. Go to `Database Access` and create a database user:
   - username: your choice
   - password: strong password
5. Go to `Network Access` and add IP:
   - For local dev: add `0.0.0.0/0` (or your current IP for tighter security)
6. Click `Connect` on your cluster -> `Drivers` -> `Node.js`.
7. Copy connection string, then set DB name to `stitchmart`:

```txt
mongodb+srv://<username>:<password>@<cluster>.mongodb.net/stitchmart?retryWrites=true&w=majority&appName=<app-name>
```

8. Paste this into `backend/.env` as `MONGODB_URI`.

## Run The App

Install dependencies:

```bash
npm install
npm --prefix backend install
```

Run backend (port 5000):

```bash
npm run backend:dev
```

Run frontend (port 9002):

```bash
npm run dev
```

## OAuth Flow (Current)

1. Frontend gets Google access token using `@react-oauth/google`.
2. Frontend calls backend `POST /api/auth/google`.
3. Backend verifies token via Google userinfo endpoint.
4. Backend upserts user and OAuth details in MongoDB `users` collection.
5. Backend returns app JWT + user profile.

## API URLs You Will Use

- Backend base: `http://localhost:5000/api`
- Health: `http://localhost:5000/api/health`
- OAuth login/save user: `http://localhost:5000/api/auth/google`

## Notes

- Existing Firebase-based product/data pages are still present in frontend and can be migrated next to backend routes.
- Auth is now stored in MongoDB through the new backend.

## Git Troubleshooting

If you see `error: remote origin already exists` or `Permission denied (publickey)`, follow these steps to switch to HTTPS:

### 1. Update the remote URL to HTTPS
Run this command in your terminal:
```bash
git remote set-url origin https://github.com/sushanth-kesava/StitchMart.git
```

### 2. Push your code
Then, push your changes to GitHub:
```bash
git push -u origin main
```
*Note: You may be asked for your GitHub username and a Personal Access Token (PAT). You can generate a PAT in your GitHub settings.*

## Render Deployment

This app is deployed as two services on Render:

1. Backend web service: `antariya-backend`
2. Frontend static site: `antariya-frontend`

Make sure these environment variables are set in Render:

1. Backend:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `FRONTEND_URL=https://antariyaofficial.com,https://antariya.onrender.com`
2. Frontend:
   - `NEXT_PUBLIC_API_BASE_URL=https://antariya-backend.onrender.com/api`
   - `NEXT_PUBLIC_SITE_URL=https://antariyaofficial.com`

If the frontend builds without `NEXT_PUBLIC_API_BASE_URL`, it will fall back to localhost at build time and the Render site will stay stuck loading because it cannot reach the backend API.

For Hostinger or any other static host, also set `NEXT_PUBLIC_SITE_URL` to the final public domain before running `npm run build`, so metadata and canonical URLs are generated for the deployed site instead of localhost.

To override the API after upload, edit `frontend/public/runtime-config.js` before building and set `apiBaseUrl` to your backend endpoint. If you leave it empty, the app uses the current site origin plus `/api`.

The ready-to-deploy static output is `frontend/out/`.

## Getting Started

1. **Configure Environment**: Add your Firebase configuration keys to a `.env` file.
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Run Development Server**:
   ```bash
   npm run dev
   ```
# AntariyaOrg
