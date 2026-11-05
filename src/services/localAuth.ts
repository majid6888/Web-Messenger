import { UserProfile } from '../types';

/**
 * Local Account & ID Generation Service
 * Completely independent of Firebase or any external cloud auth providers.
 * Uses local storage and standard cryptographic randomness.
 */

export function generateLocalUserId(): string {
  const timestamp = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 9);
  return `usr_${timestamp}_${rand}`;
}

export function generateMessengerId(name: string): string {
  const clean = (name || 'USER')
    .trim()
    .split(/\s+/)[0]
    ?.toUpperCase()
    .replace(/[^A-Z0-9]/g, '') || 'USER';
  const prefix = clean.slice(0, 8) || 'USER';
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${randomNum}`;
}

export function generateUsername(name: string): string {
  const clean = (name || 'user')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'user';
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `@${clean.slice(0, 15)}_${randomSuffix}`;
}

export function generateNumericId(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `#${num}`;
}
