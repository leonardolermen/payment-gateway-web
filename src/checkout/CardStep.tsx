import { useState, type FormEvent } from "react";
import { GatewayRequestError, messageFor } from "../support/gatewayError";
import { brandOf, type Brand } from "./brand";
import { createAttempt } from "./checkoutApi";
import type { Event } from "./checkoutState";
import { isValidLuhn } from "./luhn";

type Props = { token: string; declined?: string; send: (event: Event) => void };

const BRAND_LABELS: Record<Brand, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  elo: "Elo",
  hipercard: "Hipercard",
};

const INSTALLMENTS = Array.from({ length: 12 }, (_, i) => i + 1);
const INVALID_NUMBER = "Número de cartão inválido.";

function digitsOf(value: string, max: number): string {
  return value.replace(/\D/g, "").slice(0, max);
}

function groupInFours(digits: string): string {
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExpiry(value: string): string {
  const digits = digitsOf(value, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

/**
 * Card fields live only in this component's state and the request body. They are wiped before the
 * reducer hears the response, success or failure, so nothing that outlives this render (reducer,
 * query cache, storage, DOM) ever holds a number.
 */
export function CardStep({ token, declined, send }: Props) {
  const [number, setNumber] = useState("");
  const [holder, setHolder] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [installments, setInstallments] = useState(1);
  const [numberError, setNumberError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const brand = brandOf(number);

  function clearCard() {
    setNumber("");
    setHolder("");
    setExpiry("");
    setCvv("");
  }

  function checkNumber(): boolean {
    const isValid = isValidLuhn(number) && number.length >= 12;
    setNumberError(isValid ? null : INVALID_NUMBER);
    return isValid;
  }

  async function submit(formEvent: FormEvent) {
    formEvent.preventDefault();
    if (!checkNumber()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    const body = {
      method: "CARD" as const,
      card: { number, holder: holder.trim(), expiry, cvv },
      installments,
    };

    try {
      const payment = await createAttempt(token, body);
      clearCard();
      send({ type: "attempt_created", payment });
    } catch (e) {
      clearCard();
      const code = e instanceof GatewayRequestError ? e.error.code : "UNKNOWN";
      // A 410 means the order closed under the payer; the reducer turns that code into unavailable.
      const isGone = e instanceof GatewayRequestError && e.error.status === 410;
      setSubmitError(messageFor(e));
      send({
        type: "attempt_failed",
        code: isGone ? "CHECKOUT_ORDER_CLOSED" : code,
        message: messageFor(e),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const message = submitError ?? declined;

  return (
    <form className="flex flex-col gap-3" onSubmit={(formEvent) => void submit(formEvent)}>
      <label className="flex flex-col">
        Número do cartão
        <input
          inputMode="numeric"
          autoComplete="cc-number"
          value={groupInFours(number)}
          onChange={(change) => setNumber(digitsOf(change.target.value, 19))}
          onBlur={checkNumber}
          className="rounded border px-2 py-1"
        />
      </label>
      {brand && <span aria-label="Bandeira">{BRAND_LABELS[brand]}</span>}
      {numberError && <p role="alert">{numberError}</p>}
      <label className="flex flex-col">
        Nome impresso no cartão
        <input
          autoComplete="cc-name"
          value={holder}
          onChange={(change) => setHolder(change.target.value)}
          className="rounded border px-2 py-1"
        />
      </label>
      <label className="flex flex-col">
        Validade (MM/AA)
        <input
          inputMode="numeric"
          autoComplete="cc-exp"
          placeholder="MM/AA"
          value={expiry}
          onChange={(change) => setExpiry(formatExpiry(change.target.value))}
          className="rounded border px-2 py-1"
        />
      </label>
      <label className="flex flex-col">
        CVV
        <input
          inputMode="numeric"
          autoComplete="cc-csc"
          value={cvv}
          onChange={(change) => setCvv(digitsOf(change.target.value, 4))}
          className="rounded border px-2 py-1"
        />
      </label>
      <label className="flex flex-col">
        Parcelas
        <select
          value={installments}
          onChange={(change) => setInstallments(Number(change.target.value))}
          className="rounded border px-2 py-1"
        >
          {INSTALLMENTS.map((count) => (
            <option key={count} value={count}>
              {count}x
            </option>
          ))}
        </select>
      </label>
      {message && <p role="alert">{message}</p>}
      <button
        type="submit"
        disabled={isSubmitting || !/^\d{2}\/\d{2}$/.test(expiry) || !/^\d{3,4}$/.test(cvv)}
        className="rounded bg-black px-4 py-2 text-white"
      >
        Pagar
      </button>
    </form>
  );
}
