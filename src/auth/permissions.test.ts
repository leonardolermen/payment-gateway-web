import { describe, expect, it } from "vitest";
import { can } from "./permissions";

describe("can", () => {
  it("readonlySeesEverythingAndDoesNothing", () => {
    expect(can("READONLY", "create_charge")).toBe(false);
    expect(can("READONLY", "refund")).toBe(false);
    expect(can("READONLY", "team")).toBe(false);
    expect(can("READONLY", "rotate_checkout_link")).toBe(false);
  });

  it("financeOperatesButDoesNotConfigure", () => {
    expect(can("FINANCE", "create_charge")).toBe(true);
    expect(can("FINANCE", "refund")).toBe(true);
    expect(can("FINANCE", "capture")).toBe(true);
    expect(can("FINANCE", "rotate_checkout_link")).toBe(true);
    expect(can("FINANCE", "create_plan")).toBe(true);
    expect(can("FINANCE", "delete_customer")).toBe(false);
    expect(can("FINANCE", "installments")).toBe(false);
    expect(can("FINANCE", "team")).toBe(false);
    expect(can("FINANCE", "webhooks")).toBe(false);
  });

  it("ownerDoesEverything", () => {
    for (const action of [
      "create_charge",
      "delete_customer",
      "team",
      "store",
      "api_keys",
      "providers",
    ] as const) {
      expect(can("OWNER", action)).toBe(true);
    }
  });
});

describe("customer actions", () => {
  it("onlyTheOwnerEditsCustomersAndRemovesCards", () => {
    expect(can("FINANCE", "edit_customer")).toBe(false);
    expect(can("FINANCE", "delete_card")).toBe(false);
    expect(can("OWNER", "edit_customer")).toBe(true);
    expect(can("OWNER", "delete_card")).toBe(true);
  });
});
