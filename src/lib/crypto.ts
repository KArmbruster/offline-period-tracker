/**
 * PIN-based key derivation for SQLCipher encryption
 *
 * Note: On native platforms, SQLCipher handles the actual encryption.
 * This module provides utilities for PIN validation and key derivation.
 */

const PIN_HASH_KEY = 'pin_hash';
const SALT = 'periodtracker_salt_v1'; // Static salt for this app

/**
 * Hash a PIN using Web Crypto API (SHA-256)
 */
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + SALT);

  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Derive an encryption key from PIN for SQLCipher
 * Returns a hex string suitable for SQLCipher PRAGMA key
 */
export async function deriveEncryptionKey(pin: string): Promise<string> {
  const hash = await hashPin(pin);
  // SQLCipher expects a key, we'll use the hash directly
  return hash;
}

/**
 * Store the PIN hash for verification
 */
export async function storePinHash(pin: string): Promise<void> {
  const hash = await hashPin(pin);
  localStorage.setItem(PIN_HASH_KEY, hash);
}

/**
 * Verify if the entered PIN matches the stored hash
 */
export async function verifyPin(pin: string): Promise<boolean> {
  const storedHash = localStorage.getItem(PIN_HASH_KEY);

  if (!storedHash) {
    return false;
  }

  const enteredHash = await hashPin(pin);
  return storedHash === enteredHash;
}

/**
 * Check if a PIN has been set up
 */
export function isPinSetup(): boolean {
  return localStorage.getItem(PIN_HASH_KEY) !== null;
}

/**
 * Clear all stored data (for app reset)
 */
export function clearAllStoredData(): void {
  localStorage.removeItem(PIN_HASH_KEY);
  // Clear any other localStorage items if needed
}

/**
 * Validate PIN format (4 digits)
 */
export function validatePinFormat(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}
