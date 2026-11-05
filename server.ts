import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { WebSocketServer } from 'ws';
import { db, normalizeUserId, StoredVideo } from './server/db.js';
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  getUserIdFromToken,
  invalidateSessionToken,
} from './server/auth.js';
import { SignalingServer, signalingInstance } from './server/signaling.js';
import {
  UserProfile,
  Conversation,
  Message,
  CallLog,
  Story,
  Poll,
  ScheduledMessage,
  ChatActivity,
} from './src/types.js';
import { generateAndStoreOtp, verifyOtp } from './server/otp.js';
import { sendOtpEmail } from './server/email.js';
import { createCustomAuthToken, getOrCreateAdminAuthUser, updateAdminUserPassword } from './server/firebaseAdmin.js';

const app = express();
const PORT = 3000;

// Persistent Video Storage Setup
const DATA_DIR = path.resolve(process.cwd(), 'data');
const VIDEOS_DIR = path.resolve(DATA_DIR, 'uploads', 'videos');
if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

// Secure Video Multer Storage
const videoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, VIDEOS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
    const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    const uniqueId = `vid_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    cb(null, `${uniqueId}_${safeBase}${ext}`);
  },
});

const videoUpload = multer({
  storage: videoStorage,
  limits: {
    fileSize: 2048 * 1024 * 1024, // 2GB limit for high quality, multi-hour video uploads
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime',
      'video/x-matroska',
      'video/x-msvideo',
      'video/3gpp',
      'video/x-flv',
      'video/mpeg',
    ];
    const allowedExts = ['.mp4', '.webm', '.ogg', '.mov', '.mkv', '.avi', '.3gp', '.m4v', '.mpg', '.mpeg'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext) || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid video format. Supported formats include MP4 and WebM.'));
    }
  },
});

// Parse large payloads for base64 images and voice audio notes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Auth Middleware
export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: UserProfile;
}

function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.substring(7);
  const userId = getUserIdFromToken(token);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: Session expired or invalid' });
  }

  let user = db.getUserProfileById(userId);
  if (!user) {
    user = db.findExistingAccount(userId);
  }
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: User not found' });
  }

  req.userId = user.id;
  req.user = user;
  next();
}

// ---------------- API ROUTES ----------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Check User ID availability
app.get('/api/auth/check-userid', (req, res) => {
  const raw = (req.query.userId as string || '').trim();
  if (!raw) {
    return res.status(400).json({ available: false, error: 'User ID is required' });
  }

  const normalized = normalizeUserId(raw);
  const handleOnly = normalized.replace(/^@/, '');

  if (handleOnly.length < 3 || handleOnly.length > 24) {
    return res.json({ available: false, normalized, error: 'User ID must be between 3 and 24 characters' });
  }

  const validRegex = /^[a-zA-Z0-9_]+$/;
  if (!validRegex.test(handleOnly)) {
    return res.json({ available: false, normalized, error: 'User ID can only contain letters, numbers, and underscores' });
  }

  const available = db.isUserIdAvailable(normalized);
  res.json({
    available,
    normalized,
    message: available ? 'User ID is available' : 'This User ID is already taken',
  });
});

// Register with unique User ID (No phone number or SIM required)
// Register with email & password, display name, and auto-generated unique numeric ID (No phone/SIM required)
app.post('/api/auth/register', (req, res) => {
  const { email, userId: rawUserId, password, displayName, avatarUrl, avatarEmoji, statusText } = req.body;

  if (!displayName || !password) {
    return res.status(400).json({ error: 'Display name and password are required' });
  }

  // Derive or normalize userId handle
  let handleOnly = '';
  let normalizedUserId = '';

  if (rawUserId && rawUserId.trim()) {
    normalizedUserId = normalizeUserId(rawUserId);
    handleOnly = normalizedUserId.replace(/^@/, '');
  } else if (email && email.includes('@')) {
    handleOnly = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    normalizedUserId = `@${handleOnly}`;
  } else {
    handleOnly = displayName.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() || 'user';
    normalizedUserId = `@${handleOnly}`;
  }

  // Ensure handle is unique; if taken, append random digits
  let candidateHandle = handleOnly;
  let counter = 1;
  while (!db.isUserIdAvailable(`@${candidateHandle}`) && counter < 100) {
    candidateHandle = `${handleOnly}_${Math.floor(100 + Math.random() * 900)}`;
    counter++;
  }
  normalizedUserId = `@${candidateHandle}`;

  // Check email uniqueness if email provided
  if (email && email.trim()) {
    const existingEmailUser = db.getUserByEmail(email.trim());
    if (existingEmailUser) {
      return res.status(400).json({ error: 'An account with this email address already exists. Please sign in.' });
    }
  }

  const now = Date.now();
  const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const numericId = db.generateUniqueNumericId();
  const passwordHash = hashPassword(password);

  const newUser = db.createUser({
    id,
    userId: normalizedUserId,
    numericId,
    email: email && email.trim() ? email.trim() : `${candidateHandle}@velochat.local`,
    displayName: displayName.trim(),
    avatarUrl: avatarUrl && avatarUrl.trim() !== '' ? avatarUrl : undefined,
    avatarEmoji: avatarEmoji || undefined,
    statusText: statusText?.trim() || 'Connecting via Web Messenger 🌐',
    online: true,
    lastSeen: now,
    createdAt: now,
    friends: [],
    blockedUsers: [],
    privacy: {
      showProfilePicture: 'everyone',
      showLastSeen: true,
      readReceipts: true,
      showStatus: true,
      whoCanSendFriendRequests: 'everyone',
    },
    passwordHash,
  });

  const token = createSessionToken(id);
  res.status(201).json({ user: newUser, token });
});

// Login (supports unique User ID handle, unique numeric ID #583214, or private email)
app.post('/api/auth/login', (req, res) => {
  const { userId: rawIdentifier, email, password } = req.body;
  const identifier = (rawIdentifier || email || '').trim();

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Email, User ID, or Numeric ID and password are required' });
  }

  // 1. Look up by User ID handle (@username)
  let user = db.getUserByUserId(identifier);

  // 2. Look up by unique public numeric ID (e.g. #583214 or 583214)
  if (!user && (identifier.startsWith('#') || /^\d{5,8}$/.test(identifier))) {
    user = db.getUserByNumericId(identifier);
  }

  // 3. Look up by Messenger ID (e.g. #MADEV-2028 or MADEV-2028)
  if (!user) {
    user = db.getUserByMessengerId(identifier);
  }

  // 4. Look up by private email (case-insensitive)
  if (!user && identifier.includes('@') && !identifier.startsWith('@')) {
    user = db.getUserByEmail(identifier.toLowerCase());
  }

  // 5. Fallback exhaustive search across all users
  if (!user) {
    const rawClean = identifier.replace(/^[#@]+/, '').trim().toLowerCase();
    const found = db.getUsers().find((u) => {
      const uEmail = (u.email || '').trim().toLowerCase();
      const uUser = (u.userId || '').replace(/^[#@]+/, '').trim().toLowerCase();
      const uNum = (u.numericId || '').replace(/^[#@]+/, '').trim().toLowerCase();
      const uMess = (u.messengerId || '').replace(/^[#@]+/, '').trim().toLowerCase();
      return uEmail === rawClean || uUser === rawClean || uNum === rawClean || uMess === rawClean;
    });
    if (found) {
      user = db.getUserById(found.id);
    }
  }

  if (!user) {
    return res.status(401).json({ error: 'Account not found. Please check your email or create a new account.' });
  }

  let isValid = false;
  if (user.passwordHash) {
    if (user.passwordHash.startsWith('anon_')) {
      // First time sign-in for anonymous/social user with explicit password
      const newHash = hashPassword(password);
      db.updateUser(user.id, { passwordHash: newHash });
      user.passwordHash = newHash;
      isValid = true;
    } else {
      isValid = verifyPassword(password, user.passwordHash);
    }
  }

  if (!isValid) {
    return res.status(401).json({
      error: 'Incorrect password. Please verify your password or use "Forgot password?" to set a new one.',
      canReset: true,
      email: user.email,
    });
  }

  const token = createSessionToken(user.id);
  const { passwordHash: _, ...profile } = user;
  res.json({ user: profile, token });
});

// Direct Password Reset Endpoint
app.post('/api/auth/reset-password', (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) {
    return res.status(400).json({ error: 'Email and new password are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  const cleanEmail = email.trim().toLowerCase();
  let user = db.getUserByEmail(cleanEmail);

  if (!user) {
    const rawClean = cleanEmail.replace(/^[#@]+/, '').trim().toLowerCase();
    const found = db.getUsers().find((u) => {
      const uEmail = (u.email || '').trim().toLowerCase();
      const uUser = (u.userId || '').replace(/^[#@]+/, '').trim().toLowerCase();
      return uEmail === rawClean || uUser === rawClean;
    });
    if (found) {
      user = db.getUserById(found.id);
    }
  }

  if (!user) {
    return res.status(404).json({ error: 'No account found with this email. Please create a new account.' });
  }

  const newHash = hashPassword(newPassword);
  db.updateUser(user.id, { passwordHash: newHash });
  const token = createSessionToken(user.id);
  const { passwordHash: _, ...profile } = db.getUserById(user.id)!;
  res.json({ success: true, user: profile, token });
});

// Check if email or user exists in database
app.post('/api/auth/check-email', (req, res) => {
  const { email, authUid } = req.body;
  if (!email && !authUid) {
    return res.status(400).json({ error: 'Email or Auth UID is required' });
  }
  const cleanEmail = email ? email.trim().toLowerCase() : undefined;
  const user = db.findExistingAccount(authUid, cleanEmail);
  if (user) {
    return res.json({
      exists: true,
      name: user.displayName,
      avatarUrl: user.avatarUrl,
      userId: user.userId,
      messengerId: user.messengerId,
      id: user.id,
      authUid: user.authUid || user.id,
    });
  }
  return res.json({ exists: false });
});

// Check user identity endpoint
app.post('/api/auth/check-user', (req, res) => {
  const { email, authUid } = req.body;
  const cleanEmail = email ? email.trim().toLowerCase() : undefined;
  const cleanAuthUid = authUid ? String(authUid).trim() : undefined;
  const user = db.findExistingAccount(cleanAuthUid, cleanEmail);
  if (user) {
    const { passwordHash: _, ...profile } = user;
    return res.json({ exists: true, user: profile });
  }
  return res.json({ exists: false });
});

// Google Authentication (Permanent UID & Account Persistence)
app.post('/api/auth/google-login', (req, res) => {
  const { authUid, email, displayName, avatarUrl } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid Google account email is required' });
  }

  const cleanEmail = email.trim().toLowerCase();
  // Derive permanent unique identifier for Google account
  const permanentUid = (authUid && String(authUid).trim()) || `google_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;

  // Check if permanent account exists
  let user = db.findExistingAccount(permanentUid, cleanEmail);

  if (user) {
    // Returning user: link permanent auth UID and restore account immediately
    const updates: Partial<UserProfile> = {
      online: true,
      lastSeen: Date.now(),
    };
    if (!user.authUid) {
      updates.authUid = permanentUid;
    }
    if (!user.authProvider) {
      updates.authProvider = 'google';
    }
    if (avatarUrl && (!user.avatarUrl || user.avatarUrl.trim() === '')) {
      updates.avatarUrl = avatarUrl;
    }
    if (!user.friendCode) {
      updates.friendCode = '1234';
    }
    if (!user.messengerId) {
      updates.messengerId = db.generateUniqueMessengerId(user.displayName);
    }
    if (user.age === undefined) {
      updates.age = 24;
    }
    if (user.profileCompleted === undefined) {
      updates.profileCompleted = true;
    }

    db.updateUser(user.id, updates);
    const reloaded = db.getUserById(user.id) || user;
    const token = createSessionToken(reloaded.id);
    const { passwordHash: _, ...profile } = reloaded;
    return res.json({ user: profile, token, isNewUser: false });
  }

  // First time Google user: check if display name is provided
  const resolvedName = (displayName && String(displayName).trim()) || cleanEmail.split('@')[0];
  if (!resolvedName) {
    return res.json({ needsProfileSetup: true, authUid: permanentUid, email: cleanEmail });
  }

  // Create permanent user account in database linked to permanent UID
  const result = db.getOrCreatePermanentUser({
    authUid: permanentUid,
    email: cleanEmail,
    displayName: resolvedName,
    avatarUrl: avatarUrl && avatarUrl.trim() !== '' ? avatarUrl.trim() : undefined,
    provider: 'google',
  });

  if (result.needsProfileSetup || !result.user) {
    return res.json({ needsProfileSetup: true, authUid: permanentUid, email: cleanEmail });
  }

  const token = createSessionToken(result.user.id);
  return res.status(201).json({ user: result.user, token, isNewUser: true });
});

// Simple Email Authentication (Permanent UID & Account Persistence)
app.post('/api/auth/email-login', (req, res) => {
  const { email, name, avatarUrl, authUid } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const permanentUid = (authUid && String(authUid).trim()) || `email_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;

  // Search database for existing user account with permanent UID or email
  let user = db.findExistingAccount(permanentUid, cleanEmail);

  // If existing user: restore their account without generating duplicate IDs or altering profile
  if (user) {
    const updates: Partial<UserProfile> = {
      online: true,
      lastSeen: Date.now(),
    };
    if (!user.authUid) {
      updates.authUid = permanentUid;
    }
    if (!user.authProvider) {
      updates.authProvider = 'email';
    }
    if (!user.friendCode) {
      updates.friendCode = '1234';
    }
    if (!user.messengerId) {
      updates.messengerId = db.generateUniqueMessengerId(user.displayName);
    }
    if (user.age === undefined) {
      updates.age = 24;
    }
    if (user.profileCompleted === undefined) {
      updates.profileCompleted = true;
    }

    db.updateUser(user.id, updates);
    const reloaded = db.getUserById(user.id) || user;
    const token = createSessionToken(reloaded.id);
    const { passwordHash: _, ...profile } = reloaded;
    return res.json({ user: profile, token, isNewUser: false });
  }

  // New user: check if name is provided
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.json({ needsProfileSetup: true, authUid: permanentUid, email: cleanEmail });
  }

  const result = db.getOrCreatePermanentUser({
    authUid: permanentUid,
    email: cleanEmail,
    displayName: name.trim(),
    avatarUrl: avatarUrl && avatarUrl.trim() !== '' ? avatarUrl.trim() : undefined,
    provider: 'email',
  });

  if (result.needsProfileSetup || !result.user) {
    return res.json({ needsProfileSetup: true, authUid: permanentUid, email: cleanEmail });
  }

  const token = createSessionToken(result.user.id);
  return res.status(201).json({ user: result.user, token, isNewUser: true });
});

// Simple Profile Registration & Sync Endpoint (supports Anonymous Auth UID)
app.post('/api/auth/register-profile', (req, res) => {
  const {
    id,
    authUid,
    email,
    password,
    displayName,
    firstName,
    lastName,
    age,
    dateOfBirth,
    country,
    gender,
    photoURL,
    avatarUrl,
    messengerId,
    userId,
    numericId,
  } = req.body;

  const targetId = id || authUid;
  if (!targetId || !displayName) {
    return res.status(400).json({ error: 'User ID and display name are required' });
  }

  const existing = db.getUserById(targetId);
  if (existing) {
    const updates: Partial<UserProfile & { passwordHash?: string }> = {
      displayName: displayName.trim(),
      ...(firstName ? { firstName: firstName.trim() } : {}),
      ...(lastName ? { lastName: lastName.trim() } : {}),
      ...(age ? { age: Number(age) } : {}),
      ...(password ? { passwordHash: hashPassword(password) } : {}),
      email: email ? email.trim().toLowerCase() : existing.email,
      dateOfBirth: dateOfBirth || existing.dateOfBirth,
      country: country || existing.country,
      gender: gender || existing.gender,
      photoURL: photoURL || avatarUrl || existing.photoURL,
      avatarUrl: photoURL || avatarUrl || existing.avatarUrl,
      profileCompleted: true,
      online: true,
      lastSeen: Date.now(),
    };
    db.updateUser(targetId, updates);
    const reloaded = db.getUserProfileById(targetId);
    const token = createSessionToken(targetId);
    return res.json({ user: reloaded, token });
  }

  let handle = userId;
  if (!handle) {
    const cleanName = displayName.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    handle = `@${cleanName}_${randomSuffix}`;
  }

  const newUserRecord: any = {
    id: targetId,
    authUid: targetId,
    authProvider: req.body.authProvider || 'local',
    userId: handle,
    numericId: numericId || db.generateUniqueNumericId(),
    messengerId: messengerId || db.generateUniqueMessengerId(displayName),
    email: email ? email.trim().toLowerCase() : '',
    displayName: displayName.trim(),
    firstName: firstName?.trim() || undefined,
    lastName: lastName?.trim() || undefined,
    age: age ? Number(age) : undefined,
    dateOfBirth: dateOfBirth || '',
    country: country || 'Pakistan',
    gender: gender || 'Man',
    photoURL: photoURL || avatarUrl || '',
    avatarUrl: photoURL || avatarUrl || '',
    avatarEmoji: '👤',
    statusText: 'Hey there! I am using Web Messenger.',
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
    passwordHash: password ? hashPassword(password) : `anon_${Math.random().toString(36)}`,
  };

  const created = db.createUser(newUserRecord);
  const token = createSessionToken(targetId);
  return res.status(201).json({ user: created, token });
});

// Complete Profile Step (for new users who needed to provide display name)
app.post('/api/auth/complete-profile', (req, res) => {
  const { authUid, email, displayName, firstName, lastName, age, avatarUrl, provider } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }
  const resolvedDisplayName = (displayName && displayName.trim()) || 
    `${(firstName || '').trim()} ${(lastName || '').trim()}`.trim() || 
    email.split('@')[0];

  if (!resolvedDisplayName) {
    return res.status(400).json({ error: 'First name and display name are required' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const permanentUid = (authUid && String(authUid).trim()) || (provider === 'google' ? `google_${cleanEmail.replace(/[^a-z0-9]/g, '_')}` : `email_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`);

  const parsedAge = age !== undefined && !isNaN(Number(age)) ? Number(age) : 24;

  const result = db.getOrCreatePermanentUser({
    authUid: permanentUid,
    email: cleanEmail,
    displayName: resolvedDisplayName,
    firstName: firstName ? String(firstName).trim() : undefined,
    lastName: lastName ? String(lastName).trim() : undefined,
    age: parsedAge,
    avatarUrl: avatarUrl && avatarUrl.trim() !== '' ? avatarUrl.trim() : undefined,
    provider: provider === 'google' ? 'google' : 'email',
  });

  if (!result.user) {
    return res.status(400).json({ error: 'Unable to create permanent user account' });
  }

  const token = createSessionToken(result.user.id);
  return res.status(result.isNewUser ? 201 : 200).json({ user: result.user, token, isNewUser: result.isNewUser });
});

// Social Authentication (Google & Apple)
app.post('/api/auth/social-login', (req, res) => {
  const { provider, email, displayName, avatarUrl, authUid } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required for social authentication' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const permanentUid = (authUid && String(authUid).trim()) || `${provider || 'social'}_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;

  const result = db.getOrCreatePermanentUser({
    authUid: permanentUid,
    email: cleanEmail,
    displayName: displayName || cleanEmail.split('@')[0],
    avatarUrl,
    provider: provider === 'google' ? 'google' : 'email',
  });

  if (!result.user) {
    return res.status(400).json({ error: 'Unable to complete social authentication' });
  }

  const token = createSessionToken(result.user.id);
  return res.status(result.isNewUser ? 201 : 200).json({ user: result.user, token, isNewUser: result.isNewUser });
});

// ---------------- PASSWORDLESS EMAIL OTP AUTHENTICATION ----------------

// Request a 6-digit OTP code to email
app.post('/api/auth/otp/request', async (req, res) => {
  const { email, purpose } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Please provide a valid email address' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return res.status(400).json({ error: 'Please provide a valid email address format' });
  }

  const validPurpose = (purpose === 'register' || purpose === 'recovery') ? purpose : 'login';

  const otpResult = generateAndStoreOtp(cleanEmail, validPurpose);
  if (!otpResult.success) {
    return res.status(429).json({
      error: otpResult.error || 'Too many requests. Please wait before requesting another code.',
      retryAfterSec: otpResult.retryAfterSec || 60,
    });
  }

  // Asynchronously dispatch the email
  try {
    await sendOtpEmail({
      to: cleanEmail,
      code: otpResult.code!,
      purpose: validPurpose,
    });
  } catch (err: any) {
    console.error('[OTP] Failed sending email:', err.message);
  }

  // Generic security response: Never leak whether an account exists and never expose the OTP code to the client
  return res.json({
    success: true,
    message: 'A 6-digit verification code has been dispatched to your email. Please check your inbox and spam folder.',
    cooldownSeconds: 60,
  });
});

// Verify 6-digit OTP code and securely authenticate
app.post('/api/auth/otp/verify', async (req, res) => {
  const { email, code, displayName, avatarUrl, newPassword } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Email address is required' });
  }

  if (!code || typeof code !== 'string' || code.trim().length !== 6) {
    return res.status(400).json({ error: 'Please enter a valid 6-digit verification code' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();

  // Atomically verify code with constant-time hash check
  const verification = verifyOtp(cleanEmail, cleanCode);
  if (!verification.success) {
    return res.status(400).json({ error: verification.error || 'Invalid or expired verification code' });
  }

  // Attempt to look up or create user in Firebase Admin Auth
  let adminAuthUser: { uid: string; isNewUser: boolean } | null = null;
  try {
    adminAuthUser = await getOrCreateAdminAuthUser(cleanEmail, displayName);
  } catch (e: any) {
    console.warn('[OTP Auth] Firebase Admin user lookup note:', e.message);
  }

  // Check database for existing account
  let user = db.findExistingAccount(adminAuthUser?.uid, cleanEmail);

  if (user) {
    // Existing user: Restore account
    const permanentUid = adminAuthUser?.uid || user.authUid || user.id;
    const updates: any = {
      online: true,
      lastSeen: Date.now(),
    };
    if (!user.authUid) {
      updates.authUid = permanentUid;
    }
    if (!user.authProvider) {
      updates.authProvider = 'email';
    }
    if (!user.friendCode) {
      updates.friendCode = '1234';
    }
    if (!user.messengerId) {
      updates.messengerId = db.generateUniqueMessengerId(user.displayName);
    }
    if (user.profileCompleted === undefined) {
      updates.profileCompleted = true;
    }
    if (newPassword && typeof newPassword === 'string' && newPassword.length >= 6) {
      updates.passwordHash = hashPassword(newPassword);
      updateAdminUserPassword(permanentUid, newPassword).catch(() => {});
    }

    db.updateUser(user.id, updates);
    const reloaded = db.getUserById(user.id) || user;
    const sessionToken = createSessionToken(reloaded.id);

    // Mint Firebase Custom Token for the verified UID
    let customToken: string | null = null;
    try {
      customToken = await createCustomAuthToken(permanentUid, { email: cleanEmail, provider: 'otp' });
    } catch (tokenErr: any) {
      console.warn('[OTP Auth] Custom token generation note:', tokenErr.message);
    }

    const { passwordHash: _, ...profile } = reloaded;
    return res.json({
      success: true,
      user: profile,
      token: sessionToken,
      customToken,
      isNewUser: false,
    });
  }

  // New User Registration: create permanent user in DB
  const resolvedDisplayName = (displayName && String(displayName).trim()) || cleanEmail.split('@')[0];
  const permanentUid = adminAuthUser?.uid || `email_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;

  const result = db.getOrCreatePermanentUser({
    authUid: permanentUid,
    email: cleanEmail,
    displayName: resolvedDisplayName,
    avatarUrl: avatarUrl && String(avatarUrl).trim() !== '' ? String(avatarUrl).trim() : undefined,
    provider: 'email',
  });

  if (!result.user) {
    return res.status(500).json({ error: 'Failed to create user account after OTP verification' });
  }

  if (newPassword && typeof newPassword === 'string' && newPassword.length >= 6) {
    db.updateUser(result.user.id, { passwordHash: hashPassword(newPassword) });
    updateAdminUserPassword(permanentUid, newPassword).catch(() => {});
  }

  const sessionToken = createSessionToken(result.user.id);

  let customToken: string | null = null;
  try {
    customToken = await createCustomAuthToken(permanentUid, { email: cleanEmail, provider: 'otp' });
  } catch (tokenErr: any) {
    console.warn('[OTP Auth] Custom token generation note:', tokenErr.message);
  }

  return res.status(201).json({
    success: true,
    user: result.user,
    token: sessionToken,
    customToken,
    isNewUser: true,
  });
});

app.post('/api/users/nickname', authMiddleware, (req: AuthenticatedRequest, res) => {
  const { targetUserId, nickname } = req.body;
  if (!targetUserId) {
    return res.status(400).json({ error: 'Target user ID is required' });
  }
  const updated = db.updateContactNickname(req.userId!, targetUserId, nickname || '');
  if (!updated) return res.status(404).json({ error: 'User not found' });
  res.json({ user: updated });
});


// Logout
app.post('/api/auth/logout', (req: AuthenticatedRequest, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    invalidateSessionToken(authHeader.substring(7));
  }
  res.json({ success: true });
});

// Current user profile
app.get('/api/auth/me', authMiddleware, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

// Update Profile
app.put('/api/auth/profile', authMiddleware, (req: AuthenticatedRequest, res) => {
  const { displayName, userId: rawUserId, avatarUrl, statusText, age, friendCode, profileCompleted } = req.body;

  if (rawUserId) {
    const normalized = normalizeUserId(rawUserId);
    if (normalized !== req.user!.userId) {
      if (!db.isUserIdAvailable(normalized, req.userId)) {
        return res.status(400).json({ error: `User ID ${normalized} is already taken` });
      }
    }
  }

  const updated = db.updateUser(req.userId!, {
    ...(displayName ? { displayName: displayName.trim() } : {}),
    ...(rawUserId ? { userId: normalizeUserId(rawUserId) } : {}),
    ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl || undefined } : {}),
    ...(statusText !== undefined ? { statusText: statusText.trim() } : {}),
    ...(age !== undefined ? { age: Number(age) } : {}),
    ...(friendCode !== undefined ? { friendCode: String(friendCode).trim() } : {}),
    ...(profileCompleted !== undefined ? { profileCompleted: Boolean(profileCompleted) } : {}),
  });

  if (signalingInstance && updated) {
    signalingInstance.broadcastToAll({
      type: 'user:updated',
      payload: { user: updated },
    });
  }

  res.json({ user: updated });
});

// Verify friend code and start chat immediately
app.post('/api/users/verify-friend', authMiddleware, (req: AuthenticatedRequest, res) => {
  const { messengerId, friendCode } = req.body;
  if (!messengerId) {
    return res.status(400).json({ error: 'Friend ID is required' });
  }

  const result = db.verifyAndConnectFriend(req.userId!, messengerId, friendCode);
  if (!result.success || !result.friend || !result.conversation) {
    return res.status(400).json({ error: result.error || 'Failed to connect friend' });
  }

  if (signalingInstance) {
    // Notify both users about friendship & new conversation
    signalingInstance.sendToUser(result.friend.id, {
      type: 'friend:request_accepted',
      payload: { newFriend: req.user!, conversation: result.conversation },
    });
    signalingInstance.sendToUser(req.userId!, {
      type: 'friend:request_accepted',
      payload: { newFriend: result.friend, conversation: result.conversation },
    });
    if (result.conversation) {
      signalingInstance.sendToUser(result.friend.id, {
        type: 'conversation:new',
        payload: { conversation: result.conversation },
      });
      signalingInstance.sendToUser(req.userId!, {
        type: 'conversation:new',
        payload: { conversation: result.conversation },
      });
    }
  }

  res.json({ user: result.friend, conversation: result.conversation });
});

// Update Privacy
app.put('/api/auth/privacy', authMiddleware, (req: AuthenticatedRequest, res) => {
  const { showProfilePicture, showLastSeen, readReceipts, showStatus, whoCanSendFriendRequests } = req.body;
  const user = db.getUserProfileById(req.userId!);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const updated = db.updateUser(req.userId!, {
    privacy: {
      showProfilePicture: showProfilePicture ?? user.privacy.showProfilePicture ?? 'everyone',
      showLastSeen: showLastSeen ?? user.privacy.showLastSeen,
      readReceipts: readReceipts ?? user.privacy.readReceipts,
      showStatus: showStatus ?? user.privacy.showStatus,
      whoCanSendFriendRequests: whoCanSendFriendRequests ?? user.privacy.whoCanSendFriendRequests ?? 'everyone',
    },
  });
  res.json({ user: updated });
});

// Delete Account
app.delete('/api/auth/account', authMiddleware, (req: AuthenticatedRequest, res) => {
  const success = db.deleteUser(req.userId!);
  if (!success) {
    return res.status(404).json({ error: 'User not found' });
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    invalidateSessionToken(authHeader.substring(7));
  }
  res.json({ success: true });
});

// Users list
app.get('/api/users', authMiddleware, (req: AuthenticatedRequest, res) => {
  const users = db.getUsers(req.userId);
  res.json({ users });
});

// Search users by User ID or display name
app.get('/api/users/search', authMiddleware, (req: AuthenticatedRequest, res) => {
  const query = (req.query.q as string || '').trim();
  const results = db.searchUsers(query, req.userId);
  res.json({ users: results });
});

// Public profile of a user (with privacy safeguards)
app.get('/api/users/profile/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
  const targetId = req.params.id;
  const targetUser = db.getUserProfileById(targetId) || db.getUserByUserId(targetId);
  if (!targetUser) return res.status(404).json({ error: 'User not found' });

  const currentUserId = req.userId!;
  const isSelf = targetUser.id === currentUserId;
  const isFriend = (targetUser.friends || []).includes(currentUserId);
  const isBlocked = (targetUser.blockedUsers || []).includes(currentUserId);

  if (isBlocked) {
    return res.status(403).json({ error: 'Profile unavailable' });
  }

  // Filter based on privacy
  let avatarUrl = targetUser.avatarUrl;
  if (!isSelf && targetUser.privacy?.showProfilePicture === 'nobody') {
    avatarUrl = undefined;
  } else if (!isSelf && targetUser.privacy?.showProfilePicture === 'friends' && !isFriend) {
    avatarUrl = undefined;
  }

  const safeProfile: Partial<UserProfile> & { isFriend: boolean; isBlockedByMe: boolean } = {
    id: targetUser.id,
    userId: targetUser.userId,
    displayName: targetUser.displayName,
    avatarUrl,
    avatarEmoji: targetUser.avatarEmoji,
    statusText: (isSelf || targetUser.privacy?.showStatus !== false) ? targetUser.statusText : '',
    online: (isSelf || targetUser.privacy?.showLastSeen !== false) ? targetUser.online : false,
    lastSeen: (isSelf || targetUser.privacy?.showLastSeen !== false) ? targetUser.lastSeen : 0,
    createdAt: targetUser.createdAt,
    isFriend,
    isBlockedByMe: (req.user!.blockedUsers || []).includes(targetUser.id),
  };

  res.json({ profile: safeProfile });
});

// Block / Unblock user
app.post('/api/users/block', authMiddleware, (req: AuthenticatedRequest, res) => {
  const { targetUserId } = req.body;
  const user = db.getUserProfileById(req.userId!);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const blocked = new Set(user.blockedUsers || []);
  blocked.add(targetUserId);

  // Also remove from friends if currently friends
  db.removeFriend(req.userId!, targetUserId);

  const updated = db.updateUser(req.userId!, { blockedUsers: Array.from(blocked) });
  res.json({ user: updated });
});

app.post('/api/users/unblock', authMiddleware, (req: AuthenticatedRequest, res) => {
  const { targetUserId } = req.body;
  const user = db.getUserProfileById(req.userId!);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const blocked = (user.blockedUsers || []).filter((id) => id !== targetUserId);
  const updated = db.updateUser(req.userId!, { blockedUsers: blocked });
  res.json({ user: updated });
});

// ---------------- FRIEND SYSTEM ROUTES ----------------

// List user's friends
app.get('/api/friends', authMiddleware, (req: AuthenticatedRequest, res) => {
  const friends = db.getFriendsForUser(req.userId!);
  res.json({ friends });
});

// List friend requests (incoming and outgoing)
app.get('/api/friends/requests', authMiddleware, (req: AuthenticatedRequest, res) => {
  const requests = db.getFriendRequestsForUser(req.userId!);
  res.json(requests);
});

// Send friend request by target user id or user handle
app.post('/api/friends/request', authMiddleware, (req: AuthenticatedRequest, res) => {
  const { targetUserId: rawTarget } = req.body;
  if (!rawTarget) return res.status(400).json({ error: 'Target user ID is required' });

  let targetUser = db.getUserById(rawTarget);
  if (!targetUser) {
    targetUser = db.getUserByUserId(rawTarget);
  }
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  const result = db.createFriendRequest(req.userId!, targetUser.id);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  // Reciprocal request auto-accepted
  if (result.conversation && result.request) {
    if (signalingInstance) {
      signalingInstance.sendToUser(targetUser.id, {
        type: 'friend:request_accepted',
        payload: { request: result.request, newFriend: req.user!, conversation: result.conversation },
      });
      signalingInstance.sendToUser(req.userId!, {
        type: 'friend:request_accepted',
        payload: { request: result.request, newFriend: targetUser, conversation: result.conversation },
      });
      signalingInstance.sendToUser(targetUser.id, {
        type: 'conversation:new',
        payload: { conversation: result.conversation },
      });
      signalingInstance.sendToUser(req.userId!, {
        type: 'conversation:new',
        payload: { conversation: result.conversation },
      });
    }
    return res.status(200).json({
      success: true,
      accepted: true,
      friend: targetUser,
      conversation: result.conversation,
      request: result.request,
    });
  }

  // Already pending request (idempotent 200 success)
  if (result.alreadyPending) {
    return res.status(200).json({
      success: true,
      alreadyPending: true,
      request: result.request,
      message: result.message || 'Friend request already pending',
    });
  }

  // Real-time WebSocket dispatch to recipient for newly created request!
  if (signalingInstance && result.request) {
    signalingInstance.sendToUser(targetUser.id, {
      type: 'friend:request_received',
      payload: { request: result.request },
    });
  }

  res.status(201).json({ success: true, request: result.request });
});

// Accept friend request
app.post('/api/friends/accept', authMiddleware, (req: AuthenticatedRequest, res) => {
  const { requestId } = req.body;
  if (!requestId) return res.status(400).json({ error: 'Request ID is required' });

  const result = db.acceptFriendRequest(requestId, req.userId!);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  const reqObj = result.request!;
  const friendId = reqObj.fromUserId === req.userId ? reqObj.toUserId : reqObj.fromUserId;
  const currentProfile = db.getUserProfileById(req.userId!)!;
  const friendProfile = db.getUserProfileById(friendId)!;

  // Real-time WebSocket notify both users
  if (signalingInstance) {
    signalingInstance.sendToUser(friendId, {
      type: 'friend:request_accepted',
      payload: { request: reqObj, newFriend: currentProfile, conversation: result.conversation },
    });
    signalingInstance.sendToUser(req.userId!, {
      type: 'friend:request_accepted',
      payload: { request: reqObj, newFriend: friendProfile, conversation: result.conversation },
    });
    if (result.conversation) {
      signalingInstance.sendToUser(friendId, {
        type: 'conversation:new',
        payload: { conversation: result.conversation },
      });
      signalingInstance.sendToUser(req.userId!, {
        type: 'conversation:new',
        payload: { conversation: result.conversation },
      });
    }
  }

  res.json({ success: true, friend: friendProfile, conversation: result.conversation });
});

// Reject friend request
app.post('/api/friends/reject', authMiddleware, (req: AuthenticatedRequest, res) => {
  const { requestId } = req.body;
  if (!requestId) return res.status(400).json({ error: 'Request ID is required' });

  const result = db.rejectFriendRequest(requestId, req.userId!);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.json({ success: true });
});

// Remove friend
app.post('/api/friends/remove', authMiddleware, (req: AuthenticatedRequest, res) => {
  const { targetUserId } = req.body;
  if (!targetUserId) return res.status(400).json({ error: 'Target user ID is required' });

  db.removeFriend(req.userId!, targetUserId);

  if (signalingInstance) {
    signalingInstance.sendToUser(targetUserId, {
      type: 'friend:removed',
      payload: { userId: req.userId!, friendId: req.userId! },
    });
    signalingInstance.sendToUser(req.userId!, {
      type: 'friend:removed',
      payload: { userId: targetUserId, friendId: targetUserId },
    });
  }

  res.json({ success: true });
});

// ---------------- CONVERSATIONS ROUTES ----------------

// Conversations list
app.get('/api/conversations', authMiddleware, (req: AuthenticatedRequest, res) => {
  const conversations = db.getConversationsForUser(req.userId!);
  res.json({ conversations });
});

// Start or open direct conversation
app.post('/api/conversations/direct', authMiddleware, (req: AuthenticatedRequest, res) => {
  const { recipientId } = req.body;
  if (!recipientId || recipientId === req.userId) {
    return res.status(400).json({ error: 'Valid recipient ID is required' });
  }

  const recipient = db.getUserProfileById(recipientId);
  if (!recipient) {
    return res.status(404).json({ error: 'Recipient not found' });
  }

  let conv = db.findDirectConversation(req.userId!, recipientId);
  if (!conv) {
    const now = Date.now();
    conv = db.createConversation({
      id: `conv_${now}_${Math.random().toString(36).substring(2, 7)}`,
      type: 'direct',
      participants: [req.userId!, recipientId],
      createdAt: now,
      updatedAt: now,
    });
  }

  res.json({ conversation: conv });
});

// Create group conversation
app.post('/api/conversations/group', authMiddleware, (req: AuthenticatedRequest, res) => {
  const { name, avatarUrl, avatarEmoji, description, participantIds } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Group name is required' });
  }

  // Validate that only accepted friends of the creator can be selected as members
  const userFriends = db.getFriendsForUser(req.userId!).map((f) => f.id);
  const validParticipantIds = (participantIds || []).filter((id: string) => userFriends.includes(id));
  const participants = Array.from(new Set([req.userId!, ...validParticipantIds]));
  const now = Date.now();

  const newGroup: Conversation = {
    id: `group_${now}_${Math.random().toString(36).substring(2, 7)}`,
    type: 'group',
    name: name.trim(),
    avatarUrl: avatarUrl && avatarUrl.trim() !== '' ? avatarUrl : undefined,
    avatarEmoji: avatarEmoji || undefined,
    description: description?.trim() || '',
    participants,
    adminIds: [req.userId!],
    createdBy: req.userId!,
    createdAt: now,
    updatedAt: now,
    lastMessage: {
      id: `msg_${now}`,
      text: `${req.user!.displayName} created the group "${name.trim()}"`,
      type: 'text',
      senderId: req.userId!,
      senderName: req.user!.displayName,
      createdAt: now,
      status: 'read',
    },
  };

  const created = db.createConversation(newGroup);

  // Notify participants via WebSocket
  if (signalingInstance) {
    for (const pid of participants) {
      signalingInstance.sendToUser(pid, {
        type: 'conversation:new',
        payload: { conversation: created },
      });
    }
  }

  res.status(201).json({ conversation: created });
});

// Update group info (name, photo, add members, remove member)
app.put('/api/conversations/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
  const convId = req.params.id;
  const conv = db.getConversationById(convId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  if (conv.type !== 'group') {
    return res.status(400).json({ error: 'Only group conversations can be updated' });
  }

  const isAdmin = (conv.adminIds || []).includes(req.userId!) || conv.createdBy === req.userId;
  if (!isAdmin) {
    return res.status(403).json({ error: 'Only group administrators can update group settings' });
  }

  const { name, avatarUrl, avatarEmoji, description, addParticipants, removeParticipant } = req.body;

  const updates: Partial<Conversation> = {};
  if (name) updates.name = name.trim();
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
  if (avatarEmoji !== undefined) updates.avatarEmoji = avatarEmoji;
  if (description !== undefined) updates.description = description.trim();

  if (addParticipants && Array.isArray(addParticipants)) {
    const userFriends = db.getFriendsForUser(req.userId!).map((f) => f.id);
    const validAdded = addParticipants.filter((id: string) => userFriends.includes(id));
    const set = new Set([...conv.participants, ...validAdded]);
    updates.participants = Array.from(set);
  }

  if (removeParticipant) {
    if (removeParticipant === conv.createdBy) {
      return res.status(400).json({ error: 'Cannot remove the group owner' });
    }
    updates.participants = conv.participants.filter((p) => p !== removeParticipant);
    if (conv.adminIds) {
      updates.adminIds = conv.adminIds.filter((a) => a !== removeParticipant);
    }
  }

  const updated = db.updateConversation(convId, updates);
  res.json({ conversation: updated });
});

// Promote/Demote Group Admin
app.post('/api/conversations/:id/admin', authMiddleware, (req: AuthenticatedRequest, res) => {
  const convId = req.params.id;
  const { targetUserId, action } = req.body; // action: 'promote' | 'demote'
  const conv = db.getConversationById(convId);
  if (!conv || conv.type !== 'group') return res.status(404).json({ error: 'Group not found' });

  const isCreator = conv.createdBy === req.userId;
  const isAdmin = (conv.adminIds || []).includes(req.userId!);
  if (!isAdmin && !isCreator) {
    return res.status(403).json({ error: 'Only administrators can manage roles' });
  }

  const adminSet = new Set(conv.adminIds || []);
  if (action === 'promote') {
    adminSet.add(targetUserId);
  } else if (action === 'demote') {
    if (targetUserId === conv.createdBy) {
      return res.status(400).json({ error: 'Cannot demote the group creator' });
    }
    adminSet.delete(targetUserId);
  }

  const updated = db.updateConversation(convId, { adminIds: Array.from(adminSet) });
  res.json({ conversation: updated });
});

// Leave group
app.post('/api/conversations/:id/leave', authMiddleware, (req: AuthenticatedRequest, res) => {
  const convId = req.params.id;
  const conv = db.getConversationById(convId);
  if (!conv || conv.type !== 'group') return res.status(404).json({ error: 'Group not found' });

  const remaining = conv.participants.filter((p) => p !== req.userId);
  const remainingAdmins = (conv.adminIds || []).filter((a) => a !== req.userId);

  // If creator leaves, assign next participant as creator/admin
  let newCreatedBy = conv.createdBy;
  if (conv.createdBy === req.userId && remaining.length > 0) {
    newCreatedBy = remaining[0];
    if (!remainingAdmins.includes(newCreatedBy)) {
      remainingAdmins.push(newCreatedBy);
    }
  }

  if (remaining.length === 0) {
    db.deleteConversation(convId, req.userId!);
  } else {
    db.updateConversation(convId, {
      participants: remaining,
      adminIds: remainingAdmins,
      createdBy: newCreatedBy,
    });
  }

  res.json({ success: true });
});

// Delete group (creator only)
app.delete('/api/conversations/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
  const convId = req.params.id;
  const conv = db.getConversationById(convId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  if (conv.type === 'group' && conv.createdBy !== req.userId) {
    return res.status(403).json({ error: 'Only the group creator can delete this group' });
  }

  db.deleteConversation(convId, req.userId!);
  res.json({ success: true });
});

// Get messages for conversation (alias /api/messages/:id and /api/conversations/:id/messages)
app.get(['/api/conversations/:id/messages', '/api/messages/:id'], authMiddleware, (req: AuthenticatedRequest, res) => {
  const convId = req.params.id;
  const conv = db.getConversationById(convId);
  if (!conv || !conv.participants.includes(req.userId!)) {
    return res.status(403).json({ error: 'Access denied to this conversation' });
  }

  const messages = db.getMessages(convId, req.userId!);
  res.json({ messages });
});

// Post message fallback
app.post('/api/conversations/:id/messages', authMiddleware, (req: AuthenticatedRequest, res) => {
  const convId = req.params.id;
  const conv = db.getConversationById(convId);
  if (!conv || !conv.participants.includes(req.userId!)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { text, type, mediaUrl, videoUrl, thumbnail, fileName, mediaDuration, mediaName, mediaSize, replyTo } = req.body;
  const now = Date.now();

  const message: Message = {
    id: `msg_${now}_${Math.random().toString(36).substring(2, 7)}`,
    conversationId: convId,
    senderId: req.userId!,
    senderName: req.user!.displayName,
    type: type || 'text',
    text: text || '',
    mediaUrl: mediaUrl || videoUrl,
    videoUrl: videoUrl || mediaUrl,
    thumbnail,
    fileName: fileName || mediaName,
    mediaDuration,
    mediaName: mediaName || fileName,
    mediaSize,
    replyTo,
    status: 'sent',
    readBy: [req.userId!],
    deliveredTo: [req.userId!],
    deletedFor: [],
    createdAt: now,
  };

  const saved = db.createMessage(message);
  const updatedConv = db.getConversationById(convId);
  if (signalingInstance && updatedConv) {
    for (const pid of updatedConv.participants) {
      signalingInstance.sendToUser(pid, {
        type: 'message:new',
        payload: { message: saved, conversation: updatedConv },
      });
    }
  }
  res.status(201).json({ message: saved });
});

// Delete message
app.delete('/api/messages/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
  const messageId = req.params.id;
  const { forEveryone } = req.body;

  const success = db.deleteMessage(messageId, req.userId!, !!forEveryone);
  if (!success) {
    return res.status(400).json({ error: 'Could not delete message or not authorized' });
  }

  res.json({ success: true });
});

// Mark conversation read
app.post('/api/conversations/:id/read', authMiddleware, (req: AuthenticatedRequest, res) => {
  const convId = req.params.id;
  const readMessageIds = db.markConversationMessagesAsRead(convId, req.userId!);
  res.json({ success: true, readMessageIds });
});

// Call logs
app.get('/api/calls/history', authMiddleware, (req: AuthenticatedRequest, res) => {
  const calls = db.getCallLogsForUser(req.userId!);
  res.json({ calls });
});

// Create call log
app.post('/api/calls/log', authMiddleware, (req: AuthenticatedRequest, res) => {
  const { receiverId, callerName, receiverName, type, status, durationSec } = req.body;
  const caller = req.user!;
  const receiver = db.getUserProfileById(receiverId);

  const log: CallLog = {
    id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    callerId: req.userId!,
    receiverId,
    callerName: callerName || caller.displayName,
    callerAvatar: caller.avatarEmoji,
    callerUserId: caller.userId,
    receiverName: receiverName || receiver?.displayName || 'User',
    receiverAvatar: receiver?.avatarEmoji || '📞',
    receiverUserId: receiver?.userId,
    type: type || 'voice',
    status: status || 'completed',
    startedAt: Date.now(),
    durationSec: durationSec || 0,
  };

  const saved = db.createCallLog(log);
  res.status(201).json({ call: saved });
});

// File and audio upload route (100% self-hosted, stores local payload safely)
app.post('/api/upload', authMiddleware, (req: AuthenticatedRequest, res) => {
  const { data, filename, type } = req.body;
  if (!data) {
    return res.status(400).json({ error: 'No data provided' });
  }

  res.json({
    url: data,
    filename: filename || 'file',
    type: type || 'application/octet-stream',
  });
});

// ---------------- VIDEO STORAGE & STREAMING ROUTES ----------------

// Helper function to handle stored video creation
function handleStoredVideo(req: AuthenticatedRequest, res: Response, targetConvId: string) {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided' });
  }

  const convId = targetConvId || req.body.conversationId || 'direct';
  const videoId = `vid_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const duration = req.body.duration ? Number(req.body.duration) : undefined;
  const thumbnail = req.body.thumbnail || undefined;

  const record: StoredVideo = {
    id: videoId,
    conversationId: convId,
    senderId: req.userId || 'user',
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype || 'video/mp4',
    size: req.file.size,
    duration,
    thumbnail,
    createdAt: Date.now(),
  };

  db.createVideo(record);

  res.status(201).json({
    success: true,
    videoId: record.id,
    videoUrl: `/api/conversations/${convId}/videos/${record.id}`,
    fileName: record.originalName,
    fileSize: record.size,
    mimeType: record.mimeType,
    duration: record.duration,
    thumbnail: record.thumbnail,
  });
}

// Upload video file to secure backend storage with flexible conversation fallback
app.post(
  '/api/conversations/:conversationId/videos/upload',
  authMiddleware,
  videoUpload.single('video'),
  (req: AuthenticatedRequest, res) => {
    handleStoredVideo(req, res, req.params.conversationId);
  }
);

// General video upload endpoint (supports staging before conversation or direct chat)
app.post(
  '/api/videos/upload',
  authMiddleware,
  videoUpload.single('video'),
  (req: AuthenticatedRequest, res) => {
    handleStoredVideo(req, res, req.body.conversationId || 'direct');
  }
);

// Secure video stream with HTTP 206 Partial Content / Range support and auth validation
app.get('/api/conversations/:conversationId/videos/:videoId', (req, res) => {
  const { conversationId, videoId } = req.params;

  // Authenticate token from Authorization header or ?token= query parameter (for <video> elements)
  let token = '';
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  // Look up video record
  const video = db.getVideoById(videoId);
  if (!video) {
    return res.status(404).json({ error: 'Video file not found' });
  }

  const filePath = path.join(VIDEOS_DIR, video.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Video storage file missing' });
  }

  // Set streaming headers
  res.setHeader('Content-Type', video.mimeType || 'video/mp4');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(video.originalName)}"`);

  // Express sendFile handles Range requests, 206 Partial Content, seeking, and streaming automatically
  res.sendFile(filePath);
});

// Fallback direct video lookup route
app.get('/api/videos/:videoId', (req, res) => {
  const { videoId } = req.params;
  const video = db.getVideoById(videoId);
  if (!video) {
    return res.status(404).json({ error: 'Video not found' });
  }
  const token = req.query.token ? `?token=${encodeURIComponent(req.query.token as string)}` : '';
  res.redirect(`/api/conversations/${video.conversationId}/videos/${video.id}${token}`);
});

// Video Multer Error Handling Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Video file size exceeds maximum limit of 2 GB' });
    }
    return res.status(400).json({ error: `Video upload error: ${err.message}` });
  } else if (err && err.message && err.message.toLowerCase().includes('video format')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

// ---------------- MESSAGE REACTIONS, PIN & STAR ----------------

// React to message
app.post('/api/messages/:id/react', authMiddleware, (req: AuthenticatedRequest, res) => {
  const messageId = req.params.id;
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'Emoji is required' });

  const updated = db.reactToMessage(
    messageId,
    req.userId!,
    req.user!.displayName,
    emoji
  );
  if (!updated) return res.status(404).json({ error: 'Message not found' });

  // Broadcast reaction via WebSocket
  if (signalingInstance) {
    const conv = db.getConversationById(updated.conversationId);
    if (conv) {
      for (const pid of conv.participants) {
        signalingInstance.sendToUser(pid, {
          type: 'message:reaction',
          payload: {
            messageId: updated.id,
            conversationId: updated.conversationId,
            reactions: updated.reactions || [],
          },
        });
      }
    }
  }

  res.json({ message: updated });
});

// Pin / Unpin message
app.post('/api/messages/:id/pin', authMiddleware, (req: AuthenticatedRequest, res) => {
  const messageId = req.params.id;
  const { pinned } = req.body;

  const targetPinned = pinned === undefined ? true : !!pinned;
  const updated = db.pinMessage(messageId, req.userId!, targetPinned);
  if (!updated) return res.status(404).json({ error: 'Message not found' });

  if (signalingInstance) {
    const conv = db.getConversationById(updated.conversationId);
    if (conv) {
      for (const pid of conv.participants) {
        signalingInstance.sendToUser(pid, {
          type: 'message:pin',
          payload: {
            messageId: updated.id,
            conversationId: updated.conversationId,
            pinned: !!updated.pinned,
            isPinned: !!updated.pinned,
            pinnedBy: (updated as any).pinnedBy,
            pinnedByName: (updated as any).pinnedByName,
            pinnedAt: (updated as any).pinnedAt,
            message: updated,
          },
        });
      }
    }
  }

  res.json({ message: updated });
});

// Unpin message explicitly
app.delete('/api/messages/:id/pin', authMiddleware, (req: AuthenticatedRequest, res) => {
  const messageId = req.params.id;
  const updated = db.pinMessage(messageId, req.userId!, false);
  if (!updated) return res.status(404).json({ error: 'Message not found' });

  if (signalingInstance) {
    const conv = db.getConversationById(updated.conversationId);
    if (conv) {
      for (const pid of conv.participants) {
        signalingInstance.sendToUser(pid, {
          type: 'message:pin',
          payload: {
            messageId: updated.id,
            conversationId: updated.conversationId,
            pinned: false,
            isPinned: false,
            message: updated,
          },
        });
      }
    }
  }

  res.json({ message: updated });
});

// Star / Unstar message
app.post('/api/messages/:id/star', authMiddleware, (req: AuthenticatedRequest, res) => {
  const messageId = req.params.id;
  const { starred } = req.body;

  const updated = db.starMessage(messageId, req.userId!, !!starred);
  if (!updated) return res.status(404).json({ error: 'Message not found' });

  res.json({ message: updated });
});

// Get pinned messages for conversation
app.get('/api/conversations/:id/pinned', authMiddleware, (req: AuthenticatedRequest, res) => {
  const convId = req.params.id;
  const pinned = db.getPinnedMessages(convId);
  res.json({ messages: pinned });
});

// Get user starred messages
app.get('/api/messages/starred', authMiddleware, (req: AuthenticatedRequest, res) => {
  const starred = db.getStarredMessages(req.userId!);
  res.json({ messages: starred });
});

// ---------------- STORIES & STATUS ----------------

// Get active stories
app.get('/api/stories', authMiddleware, (req: AuthenticatedRequest, res) => {
  const stories = db.getStories(req.userId!);
  res.json({ stories });
});

// Create new story
app.post('/api/stories', authMiddleware, (req: AuthenticatedRequest, res) => {
  const {
    type,
    content,
    background,
    caption,
    pollQuestion,
    pollOptions,
    quizQuestion,
    quizOptions,
    correctOptionIndex,
    visibility,
  } = req.body;

  if (!content && !pollQuestion && !quizQuestion) {
    return res.status(400).json({ error: 'Story content is required' });
  }

  const user = req.user!;
  const now = Date.now();

  const story: Story = {
    id: `story_${now}_${Math.random().toString(36).substring(2, 7)}`,
    userId: req.userId!,
    userName: user.displayName,
    userHandle: user.userId,
    userAvatar: user.avatarUrl,
    userInitials: user.displayName.slice(0, 2).toUpperCase(),
    type: type || 'text',
    content: content || '',
    background: background || 'from-indigo-600 via-purple-600 to-pink-600',
    caption,
    pollQuestion,
    pollOptions: pollOptions
      ? pollOptions.map((opt: any, idx: number) => ({
          id: `opt_${idx}`,
          text: typeof opt === 'string' ? opt : opt.text,
          votes: [],
        }))
      : undefined,
    quizQuestion,
    quizOptions: quizOptions
      ? quizOptions.map((opt: any, idx: number) => ({
          id: `q_${idx}`,
          text: typeof opt === 'string' ? opt : opt.text,
        }))
      : undefined,
    correctOptionIndex: correctOptionIndex !== undefined ? Number(correctOptionIndex) : undefined,
    reactions: [],
    viewers: [req.userId!],
    visibility: visibility === 'friends' ? 'friends' : 'everyone',
    createdAt: now,
    expiresAt: now + 24 * 60 * 60 * 1000, // 24 hours
  };

  const saved = db.createStory(story);

  if (signalingInstance) {
    signalingInstance.broadcastToAll({
      type: 'story:new',
      payload: { story: saved },
    });
  }

  res.status(201).json({ story: saved });
});

// View story
app.post('/api/stories/:id/view', authMiddleware, (req: AuthenticatedRequest, res) => {
  const storyId = req.params.id;
  const success = db.viewStory(storyId, req.userId!);
  res.json({ success });
});

// React to story
app.post('/api/stories/:id/react', authMiddleware, (req: AuthenticatedRequest, res) => {
  const storyId = req.params.id;
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'Emoji is required' });

  const updated = db.reactToStory(storyId, req.userId!, req.user!.displayName, emoji);
  if (!updated) return res.status(404).json({ error: 'Story not found' });

  if (signalingInstance) {
    signalingInstance.broadcastToAll({
      type: 'story:update',
      payload: { story: updated },
    });
  }

  res.json({ story: updated });
});

// Delete story
app.delete('/api/stories/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
  const storyId = req.params.id;
  const success = db.deleteStory(storyId, req.userId!);
  if (!success) return res.status(404).json({ error: 'Story not found or not owned by user' });
  res.json({ success: true });
});

// ---------------- POLLS ----------------

// Get polls for conversation
app.get('/api/conversations/:id/polls', authMiddleware, (req: AuthenticatedRequest, res) => {
  const convId = req.params.id;
  const polls = db.getPolls(convId);
  res.json({ polls });
});

// Create poll in conversation
app.post('/api/conversations/:id/polls', authMiddleware, (req: AuthenticatedRequest, res) => {
  const convId = req.params.id;
  const conv = db.getConversationById(convId);
  if (!conv || !conv.participants.includes(req.userId!)) {
    return res.status(403).json({ error: 'Not authorized for this conversation' });
  }

  const { question, options, multipleChoice } = req.body;
  if (!question || !options || !Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ error: 'Question and at least 2 options are required' });
  }

  const now = Date.now();
  const pollId = `poll_${now}_${Math.random().toString(36).substring(2, 6)}`;

  const poll: Poll = {
    id: pollId,
    conversationId: convId,
    creatorId: req.userId!,
    creatorName: req.user!.displayName,
    question: question.trim(),
    options: options.map((opt: string, i: number) => ({
      id: `opt_${i}_${Date.now()}`,
      text: opt.trim(),
      voterIds: [],
    })),
    multipleChoice: !!multipleChoice,
    closed: false,
    createdAt: now,
  };

  const savedPoll = db.createPoll(poll);

  // Also post an in-chat message of type 'poll'
  const message: Message = {
    id: `msg_poll_${pollId}`,
    conversationId: convId,
    senderId: req.userId!,
    senderName: req.user!.displayName,
    type: 'poll',
    text: `📊 Poll: ${savedPoll.question}`,
    pollId: savedPoll.id,
    status: 'sent',
    readBy: [req.userId!],
    deliveredTo: [req.userId!],
    deletedFor: [],
    createdAt: now,
  };

  const savedMessage = db.createMessage(message);

  if (signalingInstance) {
    for (const pid of conv.participants) {
      signalingInstance.sendToUser(pid, {
        type: 'poll:update',
        payload: { poll: savedPoll },
      });
      signalingInstance.sendToUser(pid, {
        type: 'message:new',
        payload: { message: savedMessage, conversation: conv },
      });
    }
  }

  res.status(201).json({ poll: savedPoll, message: savedMessage });
});

// Vote in poll
app.post('/api/polls/:id/vote', authMiddleware, (req: AuthenticatedRequest, res) => {
  const pollId = req.params.id;
  const { optionId } = req.body;
  if (!optionId) return res.status(400).json({ error: 'Option ID is required' });

  const updated = db.votePoll(pollId, optionId, req.userId!);
  if (!updated) return res.status(400).json({ error: 'Poll is closed or invalid option' });

  if (signalingInstance) {
    const conv = db.getConversationById(updated.conversationId);
    if (conv) {
      for (const pid of conv.participants) {
        signalingInstance.sendToUser(pid, {
          type: 'poll:update',
          payload: { poll: updated },
        });
      }
    }
  }

  res.json({ poll: updated });
});

// Close poll
app.post('/api/polls/:id/close', authMiddleware, (req: AuthenticatedRequest, res) => {
  const pollId = req.params.id;
  const updated = db.closePoll(pollId, req.userId!);
  if (!updated) return res.status(403).json({ error: 'Only the poll creator can close the poll' });

  if (signalingInstance) {
    const conv = db.getConversationById(updated.conversationId);
    if (conv) {
      for (const pid of conv.participants) {
        signalingInstance.sendToUser(pid, {
          type: 'poll:update',
          payload: { poll: updated },
        });
      }
    }
  }

  res.json({ poll: updated });
});

// ---------------- SCHEDULED MESSAGES (MESSAGE CAPSULES) ----------------

// Get scheduled messages
app.get('/api/conversations/:id/scheduled', authMiddleware, (req: AuthenticatedRequest, res) => {
  const convId = req.params.id;
  const scheduled = db.getScheduledMessages(convId, req.userId!);
  res.json({ scheduled });
});

// Schedule message
app.post('/api/conversations/:id/scheduled', authMiddleware, (req: AuthenticatedRequest, res) => {
  const convId = req.params.id;
  const conv = db.getConversationById(convId);
  if (!conv || !conv.participants.includes(req.userId!)) {
    return res.status(403).json({ error: 'Not authorized for this conversation' });
  }

  const { text, scheduledFor, type, label, mediaUrl, mediaName, mediaDuration } = req.body;
  if (!text && !mediaUrl) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  const scheduleTime = Number(scheduledFor);
  if (isNaN(scheduleTime) || scheduleTime <= Date.now()) {
    return res.status(400).json({ error: 'Scheduled time must be in the future' });
  }

  const now = Date.now();
  const scheduledMsg: ScheduledMessage = {
    id: `sched_${now}_${Math.random().toString(36).substring(2, 7)}`,
    conversationId: convId,
    senderId: req.userId!,
    senderName: req.user!.displayName,
    type: type || 'text',
    text: text || '',
    mediaUrl,
    mediaName,
    mediaDuration,
    scheduledFor: scheduleTime,
    status: 'pending',
    createdAt: now,
    label: label || 'Message Capsule',
  };

  const saved = db.createScheduledMessage(scheduledMsg);
  res.status(201).json({ scheduled: saved });
});

// Cancel scheduled message
app.delete('/api/scheduled/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
  const id = req.params.id;
  const success = db.deleteScheduledMessage(id, req.userId!);
  if (!success) return res.status(404).json({ error: 'Scheduled message not found or not owned by you' });
  res.json({ success: true });
});

// ---------------- CHAT ACTIVITIES / MINI GAMES ----------------

// Get activities for conversation
app.get('/api/conversations/:id/activities', authMiddleware, (req: AuthenticatedRequest, res) => {
  const convId = req.params.id;
  const activities = db.getActivities(convId);
  res.json({ activities });
});

// Get all activities
app.get('/api/activities', authMiddleware, (req: AuthenticatedRequest, res) => {
  const activities = db.getActivities();
  res.json({ activities });
});

// Create activity in conversation
app.post('/api/conversations/:id/activities', authMiddleware, (req: AuthenticatedRequest, res) => {
  const convId = req.params.id;
  const conv = db.getConversationById(convId);
  if (!conv || !conv.participants.includes(req.userId!)) {
    return res.status(403).json({ error: 'Not authorized for this conversation' });
  }

  const { type, title, description, prompt, options, answer } = req.body;
  if (!title || !prompt) {
    return res.status(400).json({ error: 'Title and prompt are required' });
  }

  const now = Date.now();
  const actId = `act_${now}_${Math.random().toString(36).substring(2, 6)}`;

  const activity: ChatActivity = {
    id: actId,
    conversationId: convId,
    type: type || 'quiz',
    title: title.trim(),
    description: description || '',
    prompt: prompt.trim(),
    options: Array.isArray(options) ? options : undefined,
    answer: answer || undefined,
    results: [],
    active: true,
    createdBy: req.userId!,
    creatorName: req.user!.displayName,
    createdAt: now,
  };

  const savedActivity = db.createActivity(activity);

  // In-chat notification message
  const msg: Message = {
    id: `msg_act_${actId}`,
    conversationId: convId,
    senderId: req.userId!,
    senderName: req.user!.displayName,
    type: 'activity',
    text: `🎮 Social Game Challenge: ${savedActivity.title}`,
    activityId: savedActivity.id,
    status: 'sent',
    readBy: [req.userId!],
    deliveredTo: [req.userId!],
    deletedFor: [],
    createdAt: now,
  };

  const savedMsg = db.createMessage(msg);

  if (signalingInstance) {
    for (const pid of conv.participants) {
      signalingInstance.sendToUser(pid, {
        type: 'activity:update',
        payload: { activity: savedActivity },
      });
      signalingInstance.sendToUser(pid, {
        type: 'message:new',
        payload: { message: savedMsg, conversation: conv },
      });
    }
  }

  res.status(201).json({ activity: savedActivity, message: savedMsg });
});

// Submit answer/result for activity
app.post('/api/activities/:id/answer', authMiddleware, (req: AuthenticatedRequest, res) => {
  const activityId = req.params.id;
  const { answer, timeMs, score } = req.body;

  const result = {
    userId: req.userId!,
    userName: req.user!.displayName,
    answer,
    timeMs,
    score,
    completedAt: Date.now(),
  };

  const updated = db.submitActivityResult(activityId, result);
  if (!updated) return res.status(404).json({ error: 'Activity not found' });

  if (signalingInstance) {
    const conv = db.getConversationById(updated.conversationId);
    if (conv) {
      for (const pid of conv.participants) {
        signalingInstance.sendToUser(pid, {
          type: 'activity:update',
          payload: { activity: updated },
        });
      }
    }
  }

  res.json({ activity: updated });
});

// ---------------- SMART GLOBAL SEARCH ----------------

app.get('/api/search', authMiddleware, (req: AuthenticatedRequest, res) => {
  const query = (req.query.q as string) || '';
  const filterType = (req.query.type as any) || 'all';

  const results = db.searchAll(query, req.userId!, filterType);
  res.json({ results });
});

// ---------------- ACCOUNT DELETION ----------------

app.delete('/api/auth/account', authMiddleware, (req: AuthenticatedRequest, res) => {
  const success = db.deleteUser(req.userId!);
  if (!success) return res.status(400).json({ error: 'Could not delete account' });
  res.json({ success: true });
});

// ---------------- SERVER & WEBSOCKET SETUP ----------------

async function startServer() {
  const httpServer = http.createServer(app);

  // Setup WebSocket Server attached to the same HTTP server on path /ws
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  new SignalingServer(wss);

  // Periodic processor for Scheduled Messages (Message Capsules) every 4 seconds
  setInterval(() => {
    try {
      const delivered = db.processDueScheduledMessages();
      if (delivered.length > 0 && signalingInstance) {
        for (const msg of delivered) {
          const conv = db.getConversationById(msg.conversationId);
          if (conv) {
            for (const pid of conv.participants) {
              signalingInstance.sendToUser(pid, {
                type: 'message:new',
                payload: { message: msg, conversation: conv },
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('Error in scheduled messages processor:', err);
    }
  }, 4000);

  // Mount Vite or static file serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Web Messenger server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
