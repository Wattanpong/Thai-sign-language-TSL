import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE,
  getExpectedSessionToken,
  isValidAdminSession,
  verifyAdminPassword,
} from "./adminAuth";
import { POST as loginHandler } from "@/app/api/admin/auth/login/route";
import { POST as logoutHandler } from "@/app/api/admin/auth/logout/route";
import { GET as statusHandler } from "@/app/api/admin/auth/status/route";
import { NextRequest } from "next/server";

test("Admin Password Gate Authentication Test Suite", async (t) => {
  const originalPassword = process.env.ADMIN_PASSWORD;

  t.afterEach(() => {
    process.env.ADMIN_PASSWORD = originalPassword;
  });

  await t.test("1. Cookie configuration constants", () => {
    assert.equal(ADMIN_COOKIE_NAME, "admin_session");
    assert.equal(ADMIN_SESSION_MAX_AGE, 7 * 24 * 60 * 60);
  });

  await t.test("2. verifyAdminPassword verifies password strictly", () => {
    process.env.ADMIN_PASSWORD = "test_secure_password_123";

    assert.equal(verifyAdminPassword("test_secure_password_123"), true);
    assert.equal(verifyAdminPassword("wrong_password"), false);
    assert.equal(verifyAdminPassword(""), false);
  });

  await t.test("3. getExpectedSessionToken generates deterministic token and validates session", () => {
    process.env.ADMIN_PASSWORD = "test_secure_password_123";

    const token = getExpectedSessionToken();
    assert.ok(token.startsWith("sess_"));
    assert.equal(isValidAdminSession(token), true);
    assert.equal(isValidAdminSession("invalid_session_token"), false);
    assert.equal(isValidAdminSession(null), false);
    assert.equal(isValidAdminSession(undefined), false);
  });

  await t.test("4. Rotating ADMIN_PASSWORD immediately invalidates old session tokens", () => {
    process.env.ADMIN_PASSWORD = "initial_password_123";
    const oldToken = getExpectedSessionToken();
    assert.equal(isValidAdminSession(oldToken), true);

    // Rotate password
    process.env.ADMIN_PASSWORD = "new_rotated_password_456";
    assert.equal(isValidAdminSession(oldToken), false, "Old token must be invalid after password rotation");

    const newToken = getExpectedSessionToken();
    assert.equal(isValidAdminSession(newToken), true);
  });

  await t.test("5. API Login Handler: returns 401 on wrong password", async () => {
    process.env.ADMIN_PASSWORD = "correct_password_123";

    const req = new NextRequest("http://localhost:3000/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "wrong_password" }),
    });

    const res = await loginHandler(req);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error, "รหัสผ่านไม่ถูกต้อง");
  });

  await t.test("6. API Login Handler: returns 200 and sets httpOnly cookie on correct password", async () => {
    process.env.ADMIN_PASSWORD = "correct_password_123";

    const req = new NextRequest("http://localhost:3000/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "correct_password_123" }),
    });

    const res = await loginHandler(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    const setCookie = res.cookies.get(ADMIN_COOKIE_NAME);
    assert.ok(setCookie, "Must set admin_session cookie");
    assert.equal(setCookie.value, getExpectedSessionToken());
    assert.equal(setCookie.httpOnly, true);
    assert.equal(setCookie.sameSite, "strict");
  });

  await t.test("7. API Logout Handler: clears session cookie", async () => {
    const res = await logoutHandler();
    assert.equal(res.status, 200);
    const setCookie = res.cookies.get(ADMIN_COOKIE_NAME);
    assert.ok(setCookie);
    assert.equal(setCookie.value, "");
    assert.equal(setCookie.maxAge, 0);
  });

  await t.test("8. API Status Handler: returns authenticated status", async () => {
    process.env.ADMIN_PASSWORD = "correct_password_123";
    const validToken = getExpectedSessionToken();

    // Unauthenticated request
    const unauthReq = new NextRequest("http://localhost:3000/api/admin/auth/status");
    const unauthRes = await statusHandler(unauthReq);
    const unauthBody = await unauthRes.json();
    assert.equal(unauthBody.authenticated, false);

    // Authenticated request
    const authReq = new NextRequest("http://localhost:3000/api/admin/auth/status", {
      headers: {
        cookie: `${ADMIN_COOKIE_NAME}=${validToken}`,
      },
    });
    const authRes = await statusHandler(authReq);
    const authBody = await authRes.json();
    assert.equal(authBody.authenticated, true);
  });
});
