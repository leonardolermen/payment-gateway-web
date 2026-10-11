import type { ReactNode } from "react";
import { formatDateTime } from "../support/dates";
import { Card } from "../support/ui/Card";
import type { Address, Customer } from "./types";

function formatZip(zip: string): string {
  return zip.replace(/^(\d{5})(\d{3})$/, "$1-$2");
}

function formatAddress(address: Address): string {
  return [
    address.street,
    address.district,
    `${address.city}/${address.state}`,
    `CEP ${formatZip(address.zip)}`,
  ].join(" · ");
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[10px] font-medium tracking-wider text-muted uppercase">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export function CustomerDataCard({ customer }: { customer: Customer }) {
  return (
    <Card>
      <section aria-labelledby="customer-data-title" className="space-y-3">
        <h2 id="customer-data-title" className="font-display text-base font-semibold">
          Dados
        </h2>

        <dl className="grid gap-3 sm:grid-cols-2">
          <Item label="Nome">{customer.name}</Item>
          {/* As the API masks it: the panel never holds nor edits a full document. */}
          <Item label="Documento">
            <span className="font-mono text-xs">{customer.document}</span>
          </Item>
          <Item label="E-mail">{customer.email ?? "—"}</Item>
          <Item label="Cliente desde">{formatDateTime(customer.created_at)}</Item>
          <Item label="Endereço">{customer.address ? formatAddress(customer.address) : "—"}</Item>
        </dl>
      </section>
    </Card>
  );
}
