import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { MoneyInput } from "./MoneyInput";

function Harness({ onReport }: { onReport: (cents: number | null) => void }) {
  const [cents, setCents] = useState<number | null>(null);
  return (
    <MoneyInput
      valueCents={cents}
      onChange={(next) => {
        setCents(next);
        onReport(next);
      }}
    />
  );
}

describe("MoneyInput", () => {
  it("formatsOnBlurAndReportsCents", async () => {
    const onReport = vi.fn();
    render(<Harness onReport={onReport} />);

    const input = screen.getByLabelText("Valor");
    await userEvent.type(input, "1234,5");
    await userEvent.tab();

    expect(input).toHaveValue("R$ 1.234,50");
    expect(onReport).toHaveBeenLastCalledWith(123450);
  });

  it("reportsNullAndWarnsOnGarbage", async () => {
    const onReport = vi.fn();
    render(<Harness onReport={onReport} />);

    await userEvent.type(screen.getByLabelText("Valor"), "abc");
    await userEvent.tab();

    expect(onReport).toHaveBeenLastCalledWith(null);
    expect(screen.getByText("Valor inválido")).toBeInTheDocument();
  });
});
