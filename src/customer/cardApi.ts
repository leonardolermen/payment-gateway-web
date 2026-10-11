import { merchantRequest } from "../support/merchantRequest";
import type { SavedCard } from "./types";

export async function listCards(customerId: string): Promise<SavedCard[]> {
  const { data } = await merchantRequest<SavedCard[]>(`/v1/customers/${customerId}/cards`);
  return data;
}

// 409 while an active subscription still charges this card; the gateway's detail says so.
export async function deleteCard(id: string): Promise<void> {
  await merchantRequest(`/v1/cards/${id}`, { method: "DELETE" });
}
