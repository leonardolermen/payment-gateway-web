import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Workspace, WorkspaceEmpty } from "./Workspace";

describe("Workspace", () => {
  it("selectedPanelComesFirstBelowLg", () => {
    render(
      <Workspace selected left={<p>list</p>}>
        <p>detail</p>
      </Workspace>,
    );

    const grid = screen.getByText("list").parentElement!.parentElement!;
    expect(grid).toHaveClass("grid", "lg:grid-cols-[1.15fr_0.85fr]");
    expect(screen.getByText("detail").parentElement).toHaveClass("order-first", "lg:order-none");
  });

  it("anUnselectedPanelKeepsItsPlace", () => {
    render(
      <Workspace selected={false} left={<p>list</p>}>
        <p>detail</p>
      </Workspace>,
    );

    expect(screen.getByText("detail").parentElement).not.toHaveClass("order-first");
  });

  it("emptyStateIsHiddenOnPhones", () => {
    render(<WorkspaceEmpty>Escolha algo</WorkspaceEmpty>);

    expect(screen.getByText("Escolha algo")).toHaveClass("hidden", "lg:block");
  });
});
