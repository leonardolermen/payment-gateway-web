import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { aMe, mockMe } from "../test/me";
import { setAccessToken } from "./session";
import { useCan } from "./useCan";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useCan", () => {
  it("isFalseWhileMeIsLoading", () => {
    setAccessToken("gs_test");
    mockMe(aMe({ role: "OWNER" }));

    const { result } = renderHook(() => useCan("team"), { wrapper });

    expect(result.current).toBe(false);
  });

  it("ownerMayManageTheTeam", async () => {
    setAccessToken("gs_test");
    mockMe(aMe({ role: "OWNER" }));

    const { result } = renderHook(() => useCan("team"), { wrapper });

    await waitFor(() => expect(result.current).toBe(true));
  });

  it("financeMayRefundButNotManageTheTeam", async () => {
    setAccessToken("gs_test");
    mockMe(aMe({ role: "FINANCE" }));

    const refund = renderHook(() => useCan("refund"), { wrapper });
    const team = renderHook(() => useCan("team"), { wrapper });

    await waitFor(() => expect(refund.result.current).toBe(true));
    expect(team.result.current).toBe(false);
  });
});
