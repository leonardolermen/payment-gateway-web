import type { RequestHandler } from "msw";

// Empty on purpose: each test file adds its own handlers with server.use(...).
export const handlers: RequestHandler[] = [];
