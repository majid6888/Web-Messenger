import crypto from 'crypto';

export interface StoredOtpRecord {
  email: string;
  hashedCode: string;
  salt: string;
  purpose: 'login' | 'register' | 'recovery';
  createdAt: number;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
  lastSentAt: number;
}

// In-memory rate limiting and OTP store
const otpStore = new Map<string, StoredOtpRecord>();
const requestHistory = new Map<string, number[]>(); // email -> timestamps of requests in last hour

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const COOLDOWN_MS = 60 * 1000; // 60 seconds cooldown
const MAX_ATTEMPTS = 5;
const MAX_REQUESTS_PER_HOUR = 5;

function hashOtp(code: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(code).digest('hex');
}

/**
 * Check rate limits and issue a new secure OTP
 */
export function generateAndStoreOtp(
  email: string,
  purpose: 'login' | 'register' | 'recovery'
): { success: boolean; code?: string; error?: string; retryAfterSec?: number } {
  const cleanEmail = email.trim().toLowerCase();
  const now = Date.now();

  // Check resend cooldown
  const existing = otpStore.get(cleanEmail);
  if (existing && now - existing.lastSentAt < COOLDOWN_MS) {
    const remainingSec = Math.ceil((COOLDOWN_MS - (now - existing.lastSentAt)) / 1000);
    return {
      success: false,
      error: `Please wait ${remainingSec}s before requesting a new code.`,
      retryAfterSec: remainingSec,
    };
  }

  // Check hourly rate limit
  const timestamps = (requestHistory.get(cleanEmail) || []).filter((t) => now - t < 60 * 60 * 1000);
  if (timestamps.length >= MAX_REQUESTS_PER_HOUR) {
    return {
      success: false,
      error: 'Too many requests. Please try again in an hour.',
    };
  }

  // Generate 6-digit cryptographically secure numeric code
  const code = crypto.randomInt(100000, 1000000).toString();
  const salt = crypto.randomBytes(16).toString('hex');
  const hashedCode = hashOtp(code, salt);

  const record: StoredOtpRecord = {
    email: cleanEmail,
    hashedCode,
    salt,
    purpose,
    createdAt: now,
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    lastSentAt: now,
  };

  otpStore.set(cleanEmail, record);
  timestamps.push(now);
  requestHistory.set(cleanEmail, timestamps);

  return { success: true, code };
}

/**
 * Atomically verify a submitted OTP
 */
export function verifyOtp(
  email: string,
  submittedCode: string
): { success: boolean; error?: string; purpose?: 'login' | 'register' | 'recovery' } {
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = submittedCode.trim();
  const now = Date.now();

  const record = otpStore.get(cleanEmail);
  if (!record) {
    return {
      success: false,
      error: 'No active code found. Please request a new code.',
    };
  }

  // Check expiration
  if (now > record.expiresAt) {
    otpStore.delete(cleanEmail);
    return {
      success: false,
      error: 'Verification code has expired. Please request a new one.',
    };
  }

  // Check max attempts
  if (record.attempts >= record.maxAttempts) {
    otpStore.delete(cleanEmail);
    return {
      success: false,
      error: 'Too many incorrect attempts. This code has been invalidated. Please request a new code.',
    };
  }

  // Verify hash using constant-time comparison
  const computedHash = hashOtp(cleanCode, record.salt);
  const isValid = crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(record.hashedCode, 'hex'));

  if (!isValid) {
    record.attempts += 1;
    const remainingAttempts = record.maxAttempts - record.attempts;
    if (remainingAttempts <= 0) {
      otpStore.delete(cleanEmail);
      return {
        success: false,
        error: 'Too many incorrect attempts. Code has been invalidated. Please request a new one.',
      };
    }
    return {
      success: false,
      error: `Invalid verification code. ${remainingAttempts} ${remainingAttempts === 1 ? 'attempt' : 'attempts'} remaining.`,
    };
  }

  // Single-use enforcement: immediately delete verified OTP
  const purpose = record.purpose;
  otpStore.delete(cleanEmail);

  return {
    success: true,
    purpose,
  };
}

/**
 * Periodic cleanup of expired OTPs
 */
setInterval(() => {
  const now = Date.now();
  for (const [email, record] of otpStore.entries()) {
    if (now > record.expiresAt) {
      otpStore.delete(email);
    }
  }
}, 60 * 1000);
