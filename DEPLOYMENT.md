# Web Messenger — Architecture & Deployment Guide

A modern real-time messaging application with 1-to-1 chats, group channels, real-time voice notes, and peer-to-peer WebRTC voice/video calling with self-hosted signaling.

---

## 1. Project Structure

```
├── data/
│   └── db.json                   # Disk-backed persistent database (auto-created)
├── server/
│   ├── auth.ts                   # Password hashing (scrypt) & session management
│   ├── db.ts                     # Database controller & seed data
│   └── signaling.ts              # WebSocket server & WebRTC signaling router
├── src/
│   ├── components/
│   │   ├── AuthModal.tsx         # Login, Registration & Quick Demo Switcher
│   │   ├── CallModal.tsx         # WebRTC Voice & Video Call Overlay
│   │   ├── ChatView.tsx          # Main Chat thread, input & voice recorder
│   │   ├── GroupModal.tsx        # Group creation & member management
│   │   ├── SettingsModal.tsx     # Profile, privacy settings & blocklist
│   │   ├── Sidebar.tsx           # Navigation, chats, contacts & call history
│   │   ├── VoiceMessagePlayer.tsx# Audio wave player for voice notes
│   │   └── VoiceRecorder.tsx     # MediaRecorder audio recording & preview
│   ├── services/
│   │   ├── api.ts                # REST API client & session storage
│   │   ├── audio.ts              # Web Audio API synthesizer for ringtones & pings
│   │   ├── socket.ts             # WebSocket client with auto-reconnect
│   │   └── webrtc.ts             # RTCPeerConnection manager & camera switcher
│   ├── types.ts                  # Shared TypeScript models & WS event schemas
│   ├── App.tsx                   # Master responsive container & orchestrator
│   ├── index.css                 # Tailwind CSS entry
│   └── main.tsx                  # React entry point
├── server.ts                     # Express app + HTTP server + WS server on :3000
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 2. Dependencies

### Runtime Dependencies
- `express`: REST API backend and static asset serving
- `ws`: High-performance WebSocket server for real-time messaging and WebRTC signaling
- `react` & `react-dom`: Modern reactive UI (React 19)
- `lucide-react`: Lightweight, clean SVG iconography
- `dotenv`: Environment configuration

### Dev & Build Tools
- `vite`: Fast frontend bundler and dev server middleware
- `tsx`: TypeScript execution engine for dev mode
- `esbuild`: High-speed node server bundler (`dist/server.cjs`)
- `tailwindcss`: Modern utility CSS framework

---

## 3. Installation & Local Setup

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Environment Variables
Create a `.env` file in the root directory (optional defaults provided):
```env
PORT=3000
NODE_ENV=development
```

### Step 3: Run in Development Mode
```bash
npm run dev
```
The server will start on `http://localhost:3000` with Vite middleware and WebSocket server on `ws://localhost:3000/ws`.

---

## 4. Multi-User Testing Instructions

To test real-time two-way messaging, voice notes, and WebRTC video/voice calls:
1. Open `http://localhost:3000` in your primary browser window.
2. Log in using **Alex Rivera** (or use the one-click demo button).
3. Open a second browser window (or incognito window) at `http://localhost:3000`.
4. Log in using **Maya Chen**.
5. Send text messages, record voice notes, or click the **Video** / **Voice** call icon.
6. Notice:
   - Real-time instant delivery without page refresh
   - Read receipts (double checkmarks turning teal when read)
   - Live "typing..." indicators
   - Peer-to-peer WebRTC video stream and audio connected via local signaling!

---

## 5. Production Deployment

### Build the Application
```bash
npm run build
```
This runs:
1. `vite build` to compile the React client into static production assets in `dist/`.
2. `esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs` to compile the backend into a single self-contained CommonJS server.

### Start Production Server
```bash
NODE_ENV=production npm start
```
The unified production server serves the compiled client, REST APIs, and WebSocket signaling on port `3000`.

### Docker Deployment (Optional)
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "dist/server.cjs"]
```

---

## 6. Firebase Authentication & Authorized Domains Configuration

To allow Google Sign-In and email verification link redirection to function on your deployed domain:

1. Open the [Firebase Console](https://console.firebase.google.com/) and select project **`web-messenger-a3d88`**.
2. Navigate to **Authentication** in the left sidebar menu.
3. Click the **Settings** tab at the top.
4. Scroll to the **Authorized domains** list.
5. Click **Add domain** and enter:
   ```text
   web-messenger-2.ai.studio
   ```
6. Click **Save**.
7. Under the **Sign-in method** tab, ensure that both **Google** and **Email/Password** are set to **Enabled**.

