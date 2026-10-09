import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/render";
import { SecretField } from "./SecretField";

describe("SecretField", () => {
  it("theToggleNamesTheFieldAndReportsItsState", async () => {
    renderWithProviders([
      {
        path: "/",
        element: (
          <SecretField
            id="secret"
            label="Client secret"
            value="abc"
            onChange={vi.fn()}
            secret={{ isSet: false }}
          />
        ),
      },
    ]);

    const show = screen.getByRole("button", { name: "Mostrar Client secret" });
    expect(show).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("Client secret")).toHaveAttribute("type", "password");

    await userEvent.click(show);

    const hide = screen.getByRole("button", { name: "Ocultar Client secret" });
    expect(hide).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Client secret")).toHaveAttribute("type", "text");
  });
});
