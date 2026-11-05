import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

let appInstance: App | null = null;

function initFirebaseAdmin(): App | null {
  if (appInstance) return appInstance;
  const existingApps = getApps();
  if (existingApps.length > 0) {
    appInstance = existingApps[0];
    return appInstance;
  }

  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    let projectId = 'celtic-result-kxctm';
    if (fs.existsSync(configPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (parsed.projectId) {
          projectId = parsed.projectId;
        }
      } catch {}
    }

    // Check for service account json in env
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountJson) {
      const credentials = JSON.parse(serviceAccountJson);
      appInstance = initializeApp({
        credential: cert(credentials),
        projectId,
      });
      console.log('[FirebaseAdmin] Initialized with FIREBASE_SERVICE_ACCOUNT credentials for project:', projectId);
    } else {
      // Initialize with Application Default Credentials or project ID
      appInstance = initializeApp({
        projectId,
      });
      console.log('[FirebaseAdmin] Initialized with project ID:', projectId);
    }
    return appInstance;
  } catch (err: any) {
    console.warn('[FirebaseAdmin] Initialization warning:', err.message);
    return null;
  }
}

initFirebaseAdmin();

/**
 * Mint a Firebase Custom Auth Token for an authenticated UID
 */
export async function createCustomAuthToken(
  uid: string,
  claims?: Record<string, any>
): Promise<string | null> {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    return null;
  }
  try {
    initFirebaseAdmin();
    const token = await getAuth().createCustomToken(uid, claims);
    return token;
  } catch (err: any) {
    console.warn('[FirebaseAdmin] Note: Custom token generation note (using server session):', err.message);
    return null;
  }
}

/**
 * Find or create a user in Firebase Auth via Admin SDK
 */
export async function getOrCreateAdminAuthUser(
  email: string,
  displayName?: string
): Promise<{ uid: string; isNewUser: boolean } | null> {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    return null;
  }
  try {
    initFirebaseAdmin();
    const cleanEmail = email.trim().toLowerCase();

    try {
      const existing = await getAuth().getUserByEmail(cleanEmail);
      return { uid: existing.uid, isNewUser: false };
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        const created = await getAuth().createUser({
          email: cleanEmail,
          displayName: displayName || cleanEmail.split('@')[0],
          emailVerified: true,
        });
        return { uid: created.uid, isNewUser: true };
      }
      throw err;
    }
  } catch (err: any) {
    console.warn('[FirebaseAdmin] User lookup/creation note:', err.message);
    return null;
  }
}

/**
 * Update user password via Firebase Admin SDK
 */
export async function updateAdminUserPassword(uid: string, newPassword: string): Promise<boolean> {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    return false;
  }
  try {
    initFirebaseAdmin();
    await getAuth().updateUser(uid, { password: newPassword });
    return true;
  } catch (err: any) {
    console.warn('[FirebaseAdmin] Failed to update user password:', err.message);
    return false;
  }
}

