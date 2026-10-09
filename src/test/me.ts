import { http, HttpResponse } from "msw";
import type { Me, Role } from "../auth/types";
import { server } from "./msw/server";

type Overrides = {
  role?: Role;
  emailVerified?: boolean;
  onboardingEmailVerified?: boolean;
  name?: string;
  merchantName?: string;
};

export function aMe(overrides: Overrides = {}): Me {
  const emailVerified = overrides.emailVerified ?? true;
  const onboardingEmailVerified = overrides.onboardingEmailVerified ?? emailVerified;

  return {
    user: {
      id: "u_1",
      name: overrides.name ?? "Ana Dona",
      email: "ana@loja.dev",
      role: overrides.role ?? "OWNER",
      email_verified: emailVerified,
    },
    merchant: { id: "m_1", name: overrides.merchantName ?? "Loja de Dev" },
    onboarding: {
      email_verified: onboardingEmailVerified,
      live_enabled: onboardingEmailVerified,
    },
  };
}

export function mockMe(me: Me = aMe()): void {
  server.use(http.get("http://localhost:8080/v1/me", () => HttpResponse.json(me)));
}
