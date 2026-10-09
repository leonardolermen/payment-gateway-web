import { request } from "../support/http";
import { merchantRequest } from "../support/merchantRequest";
import { storeEnvironment } from "./environment";
import { clearSession, setAccessToken } from "./session";
import type { Me, Role, SessionSummary, Team } from "./types";

export const meKeys = {
  me: ["me"] as const,
  sessions: ["me", "sessions"] as const,
  team: ["team"] as const,
};

type Tokens = { access_token: string; expires_in: number };

// Opens a session: the refresh cookie arrives with the response, the access token stays in memory.
// Every session starts in TEST: a LIVE choice left by the previous person must not move real money
// for the next one.
async function openSession(path: string, body: unknown): Promise<Tokens> {
  const { data } = await request<Tokens>(path, { method: "POST", body, credentials: "include" });
  setAccessToken(data.access_token);
  storeEnvironment("TEST");

  return data;
}

async function postAuth(path: string, body?: unknown): Promise<void> {
  await request(path, { method: "POST", body, credentials: "include" });
}

export function signup(body: {
  store_name: string;
  name: string;
  email: string;
  password: string;
}): Promise<Tokens> {
  return openSession("/v1/auth/signup", body);
}

export function login(body: { email: string; password: string }): Promise<Tokens> {
  return openSession("/v1/auth/login", body);
}

export function acceptInvite(token: string, name: string, password: string): Promise<Tokens> {
  return openSession("/v1/auth/invite/accept", { token, name, password });
}

export async function logout(): Promise<void> {
  try {
    await postAuth("/v1/auth/logout");
  } catch {
    // Swallowed on purpose: a dead network or a 5xx must not keep someone signed in.
  } finally {
    clearSession();
  }
}

export function forgotPassword(email: string): Promise<void> {
  return postAuth("/v1/auth/password/forgot", { email });
}

export function resetPassword(token: string, password: string): Promise<void> {
  return postAuth("/v1/auth/password/reset", { token, password });
}

export function verifyEmail(token: string): Promise<void> {
  return postAuth("/v1/auth/email/verify", { token });
}

export async function getMe(): Promise<Me> {
  const { data } = await merchantRequest<Me>("/v1/me");
  return data;
}

export async function renameMe(name: string): Promise<void> {
  await merchantRequest("/v1/me", { method: "PATCH", body: { name } });
}

// The API field is literally `new`.
export async function changePassword(current: string, next: string): Promise<void> {
  await merchantRequest("/v1/me/password", { method: "POST", body: { current, new: next } });
}

export async function resendVerification(): Promise<void> {
  await merchantRequest("/v1/me/email/resend", { method: "POST" });
}

export async function listSessions(): Promise<SessionSummary[]> {
  const { data } = await merchantRequest<SessionSummary[]>("/v1/me/sessions");
  return data;
}

export async function revokeOtherSessions(): Promise<void> {
  await merchantRequest("/v1/me/sessions/others", { method: "DELETE" });
}

export async function getTeam(): Promise<Team> {
  const { data } = await merchantRequest<Team>("/v1/merchant/users");
  return data;
}

export async function invite(email: string, role: Role): Promise<void> {
  await merchantRequest("/v1/invites", { method: "POST", body: { email, role } });
}

export async function changeRole(id: string, role: Role): Promise<void> {
  await merchantRequest(`/v1/merchant/users/${id}`, { method: "PATCH", body: { role } });
}

export async function removeUser(id: string): Promise<void> {
  await merchantRequest(`/v1/merchant/users/${id}`, { method: "DELETE" });
}
