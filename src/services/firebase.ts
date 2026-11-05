import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  signOut,
  onAuthStateChanged,
  signInWithCustomToken,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocFromServer,
  Unsubscribe,
  setLogLevel,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserProfile, Conversation, Message, FriendRequest, Story, Poll, ChatActivity, CallLog } from '../types';

// Suppress verbose Firestore backend offline/retry warnings
try {
  setLogLevel('error');
} catch {
  // Ignore in environments where setLogLevel is not supported
}

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// CRITICAL: Must supply firestoreDatabaseId to getFirestore
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Guard flag: whether Cloud Firestore Token Service is active
let firestoreActive = false;

export function setFirestoreActive(active: boolean) {
  firestoreActive = active;
}

export function isFirestoreActive(): boolean {
  return firestoreActive;
}

/**
 * Strips all undefined fields recursively to prevent Firestore 'Unsupported field value: undefined' errors
 */
export function cleanForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as any;
  }
  if (Array.isArray(data)) {
    return data.map((item) => cleanForFirestore(item)) as any;
  }
  if (typeof data === 'object' && !(data instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as any)) {
      if (value !== undefined) {
        cleaned[key] = cleanForFirestore(value);
      }
    }
    return cleaned as any;
  }
  return data;
}

// Standardized Firestore Error Handling per Specification
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const currentUser = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid || null,
      email: currentUser?.email || null,
      emailVerified: currentUser?.emailVerified || null,
      isAnonymous: currentUser?.isAnonymous || null,
      tenantId: currentUser?.tenantId || null,
      providerInfo:
        currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ----------------- Auth API -----------------

/**
 * Maps Firebase Auth error codes into clear, user-friendly messages
 */
export function getAuthErrorMessage(error: any): string {
  const code = error?.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email address is already registered. Please sign in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 6 characters.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password. Please verify your credentials or reset your password.';
    case 'auth/user-not-found':
      return 'No account found with this email. Please check your email or create an account.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/too-many-requests':
      return 'Access to this account has been temporarily disabled due to many failed login attempts. Please try again later or reset your password.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before completing.';
    case 'auth/popup-blocked':
      return 'Google sign-in popup was blocked by your browser. Please allow popups for this site.';
    case 'auth/network-request-failed':
      return 'Network connection error. Please check your internet connection.';
    case 'auth/missing-password':
      return 'Please enter your password.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled in the Firebase console.';
    default:
      if (
        error?.message?.includes('token-service-api') ||
        error?.message?.includes('securetoken.googleapis.com')
      ) {
        return 'Authentication service is finishing setup. Please try signing in again in a moment.';
      }
      return error?.message || 'Authentication failed. Please try again.';
  }
}

/**
 * Ensures a valid Firestore profile exists at /users/{uid} without overwriting existing data
 */
export async function getOrCreateUserProfile(
  fbUser: FirebaseUser,
  provider: 'google' | 'email',
  additionalData?: {
    displayName?: string;
    firstName?: string;
    lastName?: string;
    age?: number;
    country?: string;
    photoURL?: string;
    avatarUrl?: string;
    avatarEmoji?: string;
    dateOfBirth?: string;
  }
): Promise<UserProfile> {
  const cleanName =
    additionalData?.displayName ||
    fbUser.displayName ||
    fbUser.email?.split('@')[0] ||
    'User';
  const handleSuffix = Math.random().toString(36).substring(2, 6);
  const cleanHandle = `@${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 12)}_${handleSuffix}`;
  const numId = `#${Math.floor(100000 + Math.random() * 900000)}`;
  const messId = `${cleanName.split(/\s+/)[0]?.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'USER'}-${Math.floor(1000 + Math.random() * 9000)}`;

  const photo = additionalData?.avatarUrl || additionalData?.photoURL || fbUser.photoURL || '';

  let profileData: UserProfile = {
    id: fbUser.uid,
    authUid: fbUser.uid,
    authProvider: provider,
    userId: cleanHandle,
    numericId: numId,
    messengerId: messId,
    email: fbUser.email || '',
    emailVerified: fbUser.emailVerified,
    displayName: cleanName,
    firstName: (additionalData as any)?.firstName,
    lastName: (additionalData as any)?.lastName,
    dateOfBirth: additionalData?.dateOfBirth || '',
    age: (additionalData as any)?.age,
    country: (additionalData as any)?.country || 'Pakistan',
    photoURL: photo,
    avatarUrl: photo,
    avatarEmoji: additionalData?.avatarEmoji || '👤',
    statusText: 'Available on Web Messenger',
    online: true,
    lastSeen: Date.now(),
    createdAt: Date.now(),
    friends: [],
    blockedUsers: [],
    profileCompleted: true,
    privacy: {
      showProfilePicture: 'everyone',
      showLastSeen: true,
      readReceipts: true,
      showStatus: true,
      whoCanSendFriendRequests: 'everyone',
    },
  };

  // Only attempt Firestore read/write if Firestore is actively connected
  if (isFirestoreActive()) {
    try {
      const userDocRef = doc(db, 'users', fbUser.uid);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        const existingData = snap.data() as UserProfile;
        const updates: Partial<UserProfile> = {
          online: true,
          lastSeen: Date.now(),
          emailVerified: fbUser.emailVerified,
        };
        if (fbUser.displayName && (!existingData.displayName || existingData.displayName === 'User')) {
          updates.displayName = fbUser.displayName;
        }
        if (additionalData?.displayName && (!existingData.displayName || existingData.displayName === 'User')) {
          updates.displayName = additionalData.displayName;
        }
        if ((additionalData as any)?.firstName) updates.firstName = (additionalData as any).firstName;
        if ((additionalData as any)?.lastName) updates.lastName = (additionalData as any).lastName;
        if ((additionalData as any)?.age) updates.age = (additionalData as any).age;
        if ((additionalData as any)?.country) updates.country = (additionalData as any).country;
        if (additionalData?.dateOfBirth && !existingData.dateOfBirth) {
          updates.dateOfBirth = additionalData.dateOfBirth;
        }
        if (additionalData?.avatarUrl && (!existingData.avatarUrl || existingData.avatarUrl === '')) {
          updates.avatarUrl = additionalData.avatarUrl;
          updates.photoURL = additionalData.avatarUrl;
        }
        if (additionalData?.avatarEmoji && !existingData.avatarEmoji) {
          updates.avatarEmoji = additionalData.avatarEmoji;
        }
        try {
          const cleanUpdates = cleanForFirestore(updates);
          await updateDoc(userDocRef, cleanUpdates);
        } catch (upErr) {
          console.warn('Profile presence update note:', upErr);
        }
        profileData = { ...existingData, ...updates };
      } else {
        const cleanProfileData = cleanForFirestore(profileData);
        await setDoc(userDocRef, cleanProfileData);
      }
    } catch (err) {
      console.warn('[Firestore] Profile sync notice:', err);
    }
  }

  return profileData;
}

/**
 * Sign in using Firebase Google popup
 */
export async function signInWithGoogle(): Promise<{ firebaseUser: FirebaseUser; userProfile: UserProfile }> {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    const fbUser = cred.user;
    const userProfile = await getOrCreateUserProfile(fbUser, 'google');
    return { firebaseUser: fbUser, userProfile };
  } catch (error: any) {
    console.error('Firebase Google Sign-In error:', error);
    throw error;
  }
}

/**
 * Register a new user using Firebase Email & Password
 */
export async function signUpWithEmail(
  fullName: string,
  email: string,
  password: string,
  extra?: {
    firstName?: string;
    lastName?: string;
    age?: number;
    country?: string;
    dateOfBirth?: string;
    avatarUrl?: string;
    avatarEmoji?: string;
  }
): Promise<{ firebaseUser: FirebaseUser; userProfile: UserProfile; verificationSent: boolean }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = fullName.trim();

  const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  const fbUser = cred.user;

  // Set displayName and photoURL in Firebase Auth profile
  const photo = extra?.avatarUrl || '';
  if (cleanName || photo) {
    try {
      await updateProfile(fbUser, {
        displayName: cleanName,
        photoURL: photo || undefined,
      });
    } catch (profileErr) {
      console.warn('Failed to update auth display name:', profileErr);
    }
  }

  // Send verification email
  let verificationSent = false;
  try {
    await sendEmailVerification(fbUser);
    verificationSent = true;
  } catch (verifErr) {
    console.warn('Could not send verification email automatically:', verifErr);
  }

  // Create safe Firestore profile (/users/{uid})
  const userProfile = await getOrCreateUserProfile(fbUser, 'email', {
    displayName: cleanName,
    firstName: extra?.firstName,
    lastName: extra?.lastName,
    age: extra?.age,
    country: extra?.country,
    photoURL: photo,
    avatarUrl: photo,
    avatarEmoji: extra?.avatarEmoji,
    dateOfBirth: extra?.dateOfBirth,
  });

  return { firebaseUser: fbUser, userProfile, verificationSent };
}

/**
 * Sign in existing user using Firebase Email & Password
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ firebaseUser: FirebaseUser; userProfile: UserProfile }> {
  const cleanEmail = email.trim().toLowerCase();
  const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
  const fbUser = cred.user;

  const userProfile = await getOrCreateUserProfile(fbUser, 'email');
  return { firebaseUser: fbUser, userProfile };
}

/**
 * Sign in using Firebase Custom Token issued after verified server OTP
 */
export async function signInWithOtpCustomToken(
  customToken: string,
  profileFallback?: Partial<UserProfile>
): Promise<{ firebaseUser: FirebaseUser; userProfile: UserProfile }> {
  const cred = await signInWithCustomToken(auth, customToken);
  const fbUser = cred.user;
  const userProfile = await getOrCreateUserProfile(fbUser, 'email', {
    displayName: profileFallback?.displayName,
    photoURL: profileFallback?.avatarUrl || profileFallback?.photoURL,
  });
  return { firebaseUser: fbUser, userProfile };
}

/**
 * Send password reset email via Firebase Auth
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  await sendPasswordResetEmail(auth, cleanEmail);
}

/**
 * Resend email verification to current user
 */
export async function resendVerificationEmail(): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('No user is currently signed in.');
  }
  await sendEmailVerification(currentUser);
}

/**
 * Sign out user from Firebase Auth
 */
export async function logOutFirebase(): Promise<void> {
  const currentUid = auth.currentUser?.uid;
  if (currentUid) {
    try {
      const userRef = doc(db, 'users', currentUid);
      await updateDoc(userRef, {
        online: false,
        lastSeen: Date.now(),
      });
    } catch {
      // Ignore offline error during log out
    }
  }
  await signOut(auth);
}

// ----------------- Real-time Firestore Listeners -----------------

/**
 * Listen to real-time updates for a single user profile
 */
export function subscribeToUserProfile(userId: string, onUpdate: (user: UserProfile) => void): Unsubscribe {
  const path = `users/${userId}`;
  return onSnapshot(
    doc(db, 'users', userId),
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as UserProfile);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

/**
 * Listen to all conversations where current user is a participant
 */
export function subscribeToConversations(userId: string, onUpdate: (conversations: Conversation[]) => void): Unsubscribe {
  const path = 'conversations';
  const q = query(collection(db, path), where('participants', 'array-contains', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: Conversation[] = [];
      snapshot.forEach((d) => {
        list.push({ ...(d.data() as Conversation), id: d.id });
      });
      // Sort by updatedAt descending
      list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

/**
 * Listen to messages inside a specific conversation
 */
export function subscribeToMessages(conversationId: string, onUpdate: (messages: Message[]) => void): Unsubscribe {
  const path = `conversations/${conversationId}/messages`;
  const q = query(collection(db, path), orderBy('createdAt', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: Message[] = [];
      snapshot.forEach((d) => {
        list.push({ ...(d.data() as Message), id: d.id });
      });
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

/**
 * Save or update user profile document in Firestore
 */
export async function saveUserProfileToFirestore(profile: UserProfile): Promise<void> {
  if (!isFirestoreActive()) return;
  const path = `users/${profile.id}`;
  try {
    const cleanProfile = cleanForFirestore(profile);
    await setDoc(doc(db, 'users', profile.id), cleanProfile, { merge: true });
  } catch (error) {
    console.warn('[Firestore] Profile save note:', error);
  }
}

/**
 * Post a message to Firestore in real-time
 */
export async function postMessageToFirestore(conversationId: string, message: Message): Promise<void> {
  if (!isFirestoreActive()) return;
  const msgPath = `conversations/${conversationId}/messages/${message.id}`;

  try {
    const cleanMsg = cleanForFirestore(message);
    await setDoc(doc(db, 'conversations', conversationId, 'messages', message.id), cleanMsg);

    const lastMessage = cleanForFirestore({
      id: message.id,
      text: message.text || '',
      type: message.type || 'text',
      senderId: message.senderId,
      senderName: message.senderName,
      createdAt: message.createdAt || Date.now(),
      status: message.status || 'sent',
    });

    try {
      await updateDoc(doc(db, 'conversations', conversationId), {
        updatedAt: Date.now(),
        lastMessage,
      });
    } catch {
      await setDoc(
        doc(db, 'conversations', conversationId),
        cleanForFirestore({
          id: conversationId,
          type: 'direct',
          participants: [message.senderId],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastMessage,
        }),
        { merge: true }
      );
    }
  } catch (error) {
    console.warn('[Firestore] Message save note:', error);
  }
}

/**
 * Create a new conversation in Firestore
 */
export async function createConversationInFirestore(conv: Conversation): Promise<void> {
  if (!isFirestoreActive()) return;
  const path = `conversations/${conv.id}`;
  try {
    const cleanConv = cleanForFirestore(conv);
    await setDoc(doc(db, 'conversations', conv.id), cleanConv, { merge: true });
  } catch (error) {
    console.warn('[Firestore] Conversation save note:', error);
  }
}
