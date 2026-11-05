import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// In-memory token store for active session tokens
const tokenStore = new Map<string, { userId: string; expiresAt: number }>();

function loadSessions(): void {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = fs.readFileSync(SESSIONS_FILE, 'utf-8');
      const list: Array<[string, { userId: string; expiresAt: number }]> = JSON.parse(raw);
      const now = Date.now();
      for (const [token, session] of list) {
        if (session.expiresAt > now) {
          tokenStore.set(token, session);
        }
      }
    }
  } catch (err) {
    console.error('Error loading sessions from disk:', err);
  }
}

function saveSessions(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const list = Array.from(tokenStore.entries());
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving sessions to disk:', err);
  }
}

// Initial load
loadSessions();

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const parts = stored.split(':');
    if (parts.length !== 2) return false;
    const [salt, key] = parts;
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    const keyBuf = Buffer.from(key, 'hex');
    const hashBuf = Buffer.from(hash, 'hex');
    if (keyBuf.length !== hashBuf.length) return false;
    return crypto.timingSafeEqual(keyBuf, hashBuf);
  } catch {
    return false;
  }
}

export function createSessionToken(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  // 10 years permanent expiration for session continuity
  const expiresAt = Date.now() + 10 * 365 * 24 * 60 * 60 * 1000;
  tokenStore.set(token, { userId, expiresAt });
  saveSessions();
  return token;
}

export function getUserIdFromToken(token: string): string | null {
  if (!token) return null;
  const session = tokenStore.get(token);
  if (session) {
    if (Date.now() > session.expiresAt) {
      tokenStore.delete(token);
      saveSessions();
      return null;
    }
    return session.userId;
  }

  // Support local token format: local_<userId>
  if (token.startsWith('local_')) {
    const rawId = token.slice(6);
    if (rawId) {
      const expiresAt = Date.now() + 10 * 365 * 24 * 60 * 60 * 1000;
      tokenStore.set(token, { userId: rawId, expiresAt });
      saveSessions();
      return rawId;
    }
  }

  // Support Firebase JWT / standard JWT tokens: header.payload.signature
  if (token.includes('.')) {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const decoded = Buffer.from(base64, 'base64').toString('utf-8');
        const payload = JSON.parse(decoded);
        const uid = payload.user_id || payload.sub || payload.uid;
        if (uid && typeof uid === 'string') {
          const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
          tokenStore.set(token, { userId: uid, expiresAt });
          saveSessions();
          return uid;
        }
      }
    } catch {
      // Not a valid JWT, proceed
    }
  }

  return null;
}

export function invalidateSessionToken(token: string): void {
  tokenStore.delete(token);
  saveSessions();
}

