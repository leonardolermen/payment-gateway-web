import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { PasswordField } from "./PasswordField";

function Harness() {
  const [password, setPassword] = useState("");

  return (
    <PasswordField
      id="password"
      label="Senha"
      value={password}
      onChange={setPassword}
      autoComplete="new-password"
      showStrength
    />
  );
}

describe("PasswordField", () => {
  it("togglesBetweenHiddenAndShown", async () => {
    render(<Harness />);
    const input = screen.getByLabelText("Senha");
    expect(input).toHaveAttribute("type", "password");

    await userEvent.click(screen.getByRole("button", { name: "Mostrar" }));
    expect(input).toHaveAttribute("type", "text");

    await userEvent.click(screen.getByRole("button", { name: "Ocultar" }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("gradesStrengthByLength", async () => {
    render(<Harness />);
    const input = screen.getByLabelText("Senha");

    await userEvent.type(input, "123456789");
    expect(screen.getByText("curta demais")).toBeInTheDocument();

    await userEvent.type(input, "0");
    expect(screen.getByText("razoável")).toBeInTheDocument();

    await userEvent.type(input, "1234");
    expect(screen.getByText("forte")).toBeInTheDocument();
  });
});
