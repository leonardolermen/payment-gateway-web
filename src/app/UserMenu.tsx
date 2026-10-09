import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { logout } from "../auth/authApi";
import { roleLabel } from "../auth/roleLabels";
import type { Me } from "../auth/types";

export function UserMenu({ me }: { me: Me }) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    try {
      await logout();
    } finally {
      // The cache belongs to the user that just left, and nothing may keep them on this screen.
      queryClient.clear();
      navigate("/login", { replace: true });
    }
  }

  return (
    <div
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setIsOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="max-w-40 truncate rounded-pill px-2 py-1 text-xs font-semibold text-muted hover:text-ink"
      >
        {me.user.name}
      </button>
      {isOpen && (
        <div className="absolute right-0 z-10 mt-2 w-48 space-y-2 rounded-lg border border-line bg-surface p-3 shadow">
          <div>
            <p className="truncate font-medium">{me.user.name}</p>
            <p className="text-xs text-muted">{roleLabel(me.user.role)}</p>
          </div>
          <Link
            to="/app/settings?tab=account"
            onClick={() => setIsOpen(false)}
            className="block text-xs hover:text-accent"
          >
            Minha conta
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="block text-xs font-semibold text-muted hover:text-accent"
          >
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
