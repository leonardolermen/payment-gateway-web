import { useState, type FormEvent } from "react";
import { messageFor } from "../support/gatewayError";
import { buttonClasses } from "../support/ui/buttonClasses";
import { INPUT_CLASSES } from "../support/ui/inputClasses";
import { brandOf, type Brand } from "./brand";
import { createAttempt } from "./checkoutApi";
import type { Event } from "./checkoutState";
import { failureEvent } from "./failureEvent";
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

/** The field takes the MM/AA printed on the card; the API (and the Cielo) want MM/YYYY. */
function toApiExpiry(expiry: string): string {
  const [month, year] = expiry.split("/");
  return `${month}/20${year}`;
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
      card: { number, holder: holder.trim(), expiry: toApiExpiry(expiry), cvv },
      installments,
    };

    try {
      const payment = await createAttempt(token, body);
      clearCard();
      send({ type: "attempt_created", payment });
    } catch (e) {
      clearCard();
      setSubmitError(messageFor(e));
      send(failureEvent(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  const message = submitError ?? declined;

  return (
    <form className="flex flex-col gap-4" onSubmit={(formEvent) => void submit(formEvent)}>
      <label className="flex flex-col text-sm font-medium">
        Número do cartão
        <input
          inputMode="numeric"
          autoComplete="cc-number"
          value={groupInFours(number)}
          onChange={(change) => setNumber(digitsOf(change.target.value, 19))}
          onBlur={checkNumber}
          className={`${INPUT_CLASSES} mt-1`}
        />
      </label>
      {brand && (
        <span aria-label="Bandeira" className="text-sm text-muted">
          {BRAND_LABELS[brand]}
        </span>
      )}
      {numberError && (
        <p role="alert" className="text-sm text-danger">
          {numberError}
        </p>
      )}
      <label className="flex flex-col text-sm font-medium">
        Nome impresso no cartão
        <input
          autoComplete="cc-name"
          value={holder}
          onChange={(change) => setHolder(change.target.value)}
          className={`${INPUT_CLASSES} mt-1`}
        />
      </label>
      <label className="flex flex-col text-sm font-medium">
        Validade (MM/AA)
        <input
          inputMode="numeric"
          autoComplete="cc-exp"
          placeholder="MM/AA"
          value={expiry}
          onChange={(change) => setExpiry(formatExpiry(change.target.value))}
          className={`${INPUT_CLASSES} mt-1`}
        />
      </label>
      <label className="flex flex-col text-sm font-medium">
        CVV
        <input
          inputMode="numeric"
          autoComplete="cc-csc"
          value={cvv}
          onChange={(change) => setCvv(digitsOf(change.target.value, 4))}
          className={`${INPUT_CLASSES} mt-1`}
        />
      </label>
      <label className="flex flex-col text-sm font-medium">
        Parcelas
        <select
          value={installments}
          onChange={(change) => setInstallments(Number(change.target.value))}
          className={`${INPUT_CLASSES} mt-1`}
        >
          {INSTALLMENTS.map((count) => (
            <option key={count} value={count}>
              {count}x
            </option>
          ))}
        </select>
      </label>
      {message && (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={isSubmitting || !/^\d{2}\/\d{2}$/.test(expiry) || !/^\d{3,4}$/.test(cvv)}
        className={buttonClasses("primary", "lg")}
      >
        Pagar
      </button>
    </form>
  );
}
