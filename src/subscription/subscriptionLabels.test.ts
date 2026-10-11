import { describe, expect, it } from "vitest";
import type { BadgeTone } from "../support/ui/Badge";
import { SUBSCRIPTION_STATUS } from "./subscriptionLabels";
import type { SubscriptionStatus } from "./types";

const EXPECTED: [SubscriptionStatus, string, BadgeTone][] = [
  ["ACTIVE", "Ativa", "ok"],
  ["PAST_DUE", "Em atraso", "warn"],
  ["INCOMPLETE", "Incompleta", "neutral"],
  ["INCOMPLETE_EXPIRED", "Expirada", "neutral"],
  ["CANCELED", "Cancelada", "neutral"],
  ["ENDED", "Encerrada", "neutral"],
];

describe("SUBSCRIPTION_STATUS", () => {
  it.each(EXPECTED)("%s reads %s with the %s tone", (status, label, tone) => {
    expect(SUBSCRIPTION_STATUS[status]).toEqual({ label, tone });
  });

  it("coversEveryStatusTheApiSends", () => {
    expect(Object.keys(SUBSCRIPTION_STATUS).sort()).toEqual(
      EXPECTED.map(([status]) => status).sort(),
    );
  });
});
