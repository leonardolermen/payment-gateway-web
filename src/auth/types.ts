export type Role = "OWNER" | "FINANCE" | "READONLY";

export type Me = {
  user: { id: string; name: string; email: string; role: Role; email_verified: boolean };
  merchant: { id: string; name: string };
  onboarding: { email_verified: boolean; live_enabled: boolean };
};

export type SessionSummary = {
  id: string;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  last_used_at: string;
  current: boolean;
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: Role;
  last_login_at: string | null;
};

export type PendingInvite = { email: string; role: Role; expires_at: string };

export type Team = { users: TeamMember[]; invites: PendingInvite[] };
