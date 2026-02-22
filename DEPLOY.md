# App Vault — Deployment Guide

## Overview
- **Framework:** React (Create React App)
- **Database:** Firebase Firestore (real-time sync)
- **Hosting:** Vercel
- **No API keys are hardcoded** — all secrets live in environment variables.

---

## Step 1 — Set Up Firebase

### 1a. Enable Firestore
1. Go to [Firebase Console](https://console.firebase.google.com) → **appvault-64896**
2. Click **Firestore Database** → **Create database**
3. Choose **Start in test mode** (you can lock it down later)
4. Pick your region → **Enable**

### 1b. Set Firestore Security Rules (after testing)
In the Firebase console → Firestore → Rules, paste:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /apps/{docId} {
      allow read, write: if true; // Lock down with auth later
    }
  }
}
```

---

## Step 2 — Deploy to Vercel

### 2a. Push code to GitHub
```bash
cd appvault
git init
git add .
git commit -m "Initial commit"
gh repo create appvault --private --source=. --push
# OR: push to your existing repo
```

### 2b. Import to Vercel
1. Go to [vercel.com/georges-projects-b78bafb0](https://vercel.com/georges-projects-b78bafb0)
2. Click **Add New → Project**
3. Import your **appvault** GitHub repo
4. Framework preset: **Create React App** (auto-detected)

### 2c. Add Environment Variables in Vercel
In the Vercel project settings → **Environment Variables**, add each of these:

| Variable Name                         | Value                                      |
|---------------------------------------|--------------------------------------------|
| `REACT_APP_FIREBASE_API_KEY`          | `AIzaSyBbhCOmzzfhMITVXdJpmR4nj6-ORJXRv68` |
| `REACT_APP_FIREBASE_AUTH_DOMAIN`      | `appvault-64896.firebaseapp.com`           |
| `REACT_APP_FIREBASE_PROJECT_ID`       | `appvault-64896`                           |
| `REACT_APP_FIREBASE_STORAGE_BUCKET`   | `appvault-64896.firebasestorage.app`       |
| `REACT_APP_FIREBASE_MESSAGING_SENDER_ID` | `135333381045`                          |
| `REACT_APP_FIREBASE_APP_ID`           | `1:135333381045:web:e32dbab8c5e804ba0d4ffc` |
| `REACT_APP_FIREBASE_MEASUREMENT_ID`   | `G-2R9V17YLHY`                            |

> ⚠️ Set these for **Production**, **Preview**, and **Development** environments.

### 2d. Deploy
Click **Deploy**. Vercel will build and publish automatically.

---

## Step 3 — Local Development

Create a `.env.local` file (never commit this):
```bash
cp .env.example .env.local
# Then fill in the values from the table above
```

Install and run:
```bash
npm install
npm start
```

---

## How It Works

- On first load, if Firestore has no documents, the app **auto-seeds** all 6 sample apps.
- All CRUD operations (add, edit, delete) write directly to Firestore.
- The Firestore `onSnapshot` listener keeps every tab/device in sync in real-time.
- The spinner shows while the initial data loads.

---

## File Structure
```
appvault/
├── public/
│   └── index.html
├── src/
│   ├── firebase.js      ← Firebase init (reads from env vars)
│   ├── App.js           ← Full UI + Firestore integration
│   └── index.js         ← React entry point
├── .env.example         ← Template (safe to commit)
├── .gitignore           ← Excludes .env.local
├── package.json
└── vercel.json          ← SPA routing fix
```
