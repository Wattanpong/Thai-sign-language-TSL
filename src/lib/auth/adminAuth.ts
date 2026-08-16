/**
 * Admin Authentication Utilities for Simple Password Gate
 */

export const ADMIN_COOKIE_NAME = "admin_session";
export const ADMIN_SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Generates an internal deterministic session token from ADMIN_PASSWORD
 */
export function getExpectedSessionToken(): string {
  const secret = process.env.ADMIN_PASSWORD || "";
  if (!secret) return "";

  // Compute deterministic hash so raw password is never stored in cookie
  let hash = 0;
  const str = `tsl_admin_salt_${secret}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `sess_${Math.abs(hash).toString(36)}_${str.length.toString(36)}`;
}

/**
 * Validates whether the given session token cookie is valid
 */
export function isValidAdminSession(token: string | undefined | null): boolean {
  if (!token) return false;
  const expected = getExpectedSessionToken();
  if (!expected) return false;
  return token === expected;
}

/**
 * Verifies submitted password against ADMIN_PASSWORD
 */
export function verifyAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return password.trim() === expected.trim();
}
