import { merchantRequest } from "../support/merchantRequest";
import type { SavedCard } from "./types";

export async function listCards(customerId: string): Promise<SavedCard[]> {
  const { data } = await merchantRequest<SavedCard[]>(`/v1/customers/${customerId}/cards`);
  return data;
}

// The gateway removes the card even when a subscription charges it (no 409 today): that
// subscription's next charge fails. The confirmation says so.
export async function deleteCard(id: string): Promise<void> {
  await merchantRequest(`/v1/cards/${id}`, { method: "DELETE" });
}

export const cardKeys = {
  detail: (id: string) => ["cards", id] as const,
};

export async function getCard(id: string): Promise<SavedCard> {
  const { data } = await merchantRequest<SavedCard>(`/v1/cards/${id}`);
  return data;
}
