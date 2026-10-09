import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Tabs } from "./Tabs";

describe("Tabs", () => {
  it("marksTheSelectedTabAndReportsAClick", async () => {
    const onSelect = vi.fn();
    render(
      <Tabs
        tabs={[
          { id: "account", label: "Conta" },
          { id: "installments", label: "Parcelamento" },
        ]}
        selected="account"
        onSelect={onSelect}
      />,
    );

    expect(screen.getByRole("tab", { name: "Conta" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Parcelamento" })).toHaveAttribute(
      "aria-selected",
      "false",
    );

    await userEvent.click(screen.getByRole("tab", { name: "Parcelamento" }));
    expect(onSelect).toHaveBeenCalledWith("installments");
  });
});
