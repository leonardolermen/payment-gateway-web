import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { storeApiKey } from "../auth/apiKey";
import { aCustomer } from "../test/fixtures/customers";
import { server } from "../test/msw/server";
import { CustomerPicker } from "./CustomerPicker";

function renderPicker(onChange: () => void) {
  storeApiKey("gk_test_abc");
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <CustomerPicker value={null} onChange={onChange} />
    </QueryClientProvider>,
  );
}

describe("CustomerPicker", () => {
  it("searchesByDocumentAndSelectsTheCustomerId", async () => {
    let requestedDocument: string | null = null;
    server.use(
      http.get("http://localhost:8080/v1/customers", ({ request }) => {
        requestedDocument = new URL(request.url).searchParams.get("document");
        return HttpResponse.json([aCustomer()]);
      }),
    );
    const onChange = vi.fn();
    renderPicker(onChange);

    await userEvent.type(screen.getByLabelText("Documento do cliente"), "12345678909");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(await screen.findByText("Maria Souza")).toBeInTheDocument();
    expect(screen.getByText("***.982.247-**")).toBeInTheDocument();
    expect(requestedDocument).toBe("12345678909");

    await userEvent.click(screen.getByRole("button", { name: "Selecionar" }));
    expect(onChange).toHaveBeenLastCalledWith({ customer_id: "cus_00000001" });
  });

  it("sendsTheDocumentAsDigitsOnly", async () => {
    let requestedDocument: string | null = null;
    server.use(
      http.get("http://localhost:8080/v1/customers", ({ request }) => {
        requestedDocument = new URL(request.url).searchParams.get("document");
        return HttpResponse.json([]);
      }),
    );
    renderPicker(vi.fn());

    await userEvent.type(screen.getByLabelText("Documento do cliente"), "529.982.247-25");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));

    await screen.findByText("Nenhum cliente com este documento.");
    expect(requestedDocument).toBe("52998224725");
  });

  it("saysWhenNobodyHasThatDocument", async () => {
    server.use(http.get("http://localhost:8080/v1/customers", () => HttpResponse.json([])));
    renderPicker(vi.fn());

    await userEvent.type(screen.getByLabelText("Documento do cliente"), "12345678909");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(await screen.findByText("Nenhum cliente com este documento.")).toBeInTheDocument();
  });

  it("buildsAnInlineCustomerInNewMode", async () => {
    const onChange = vi.fn();
    renderPicker(onChange);

    await userEvent.click(screen.getByRole("radio", { name: "Novo" }));
    await userEvent.type(screen.getByLabelText("Nome"), "Ana Lima");
    await userEvent.type(screen.getByLabelText("Documento"), "12345678909");

    expect(onChange).toHaveBeenLastCalledWith({
      customer: { name: "Ana Lima", document: "12345678909" },
    });
  });
});
