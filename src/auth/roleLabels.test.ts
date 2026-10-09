import { describe, expect, it } from "vitest";
import { roleLabel } from "./roleLabels";

describe("roleLabel", () => {
  it("namesEachRoleTheWayThePanelShowsIt", () => {
    expect(roleLabel("OWNER")).toBe("Dono");
    expect(roleLabel("FINANCE")).toBe("Financeiro");
    expect(roleLabel("READONLY")).toBe("Leitura");
  });
});
