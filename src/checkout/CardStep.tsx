import { useRef, useState, type FormEvent } from "react";
import { messageFor } from "../support/gatewayError";
import { formatBrl } from "../support/money";
import { buttonClasses } from "../support/ui/buttonClasses";
import { Field } from "../support/ui/Field";
import { INPUT_CLASSES } from "../support/ui/inputClasses";
import { brandOf, type Brand } from "./brand";
import { CardPreview } from "./CardPreview";
import {
  cvvLength,
  digitsOf,
  expiryError,
  formatExpiry,
  groupDigits,
  maxDigits,
  toApiExpiry,
} from "./cardFormat";
import { createAttempt } from "./checkoutApi";
import type { Event } from "./checkoutState";
import { failureEvent } from "./failureEvent";
import { isValidLuhn } from "./luhn";
import type { InstallmentOption } from "./types";

type Props = {
  token: string;
  amount: number;
  installmentOptions: InstallmentOption[];
  // Set on a subscription's first invoice: the payer must know before paying that the card stays.
  subscriptionPlan?: string | null;
  declined?: string;
  send: (event: Event) => void;
};

const BRAND_LABELS: Record<Brand, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  elo: "Elo",
  hipercard: "Hipercard",
};

type FieldName = "number" | "holder" | "expiry" | "cvv";
type Errors = Partial<Record<FieldName, string>>;

function optionLabel(option: InstallmentOption): string {
  const each = `${option.count}x de ${formatBrl(option.installment_amount)}`;
  return option.interest_free ? `${each} sem juros` : `${each} (total ${formatBrl(option.total)})`;
}

function validate(
  number: string,
  holder: string,
  expiry: string,
  cvv: string,
  brand: Brand | null,
) {
  const errors: Errors = {};
  if (number.length < 12 || !isValidLuhn(number)) {
    errors.number = "Número de cartão inválido.";
  }
  if (holder.trim().length < 2) {
    errors.holder = "Informe o nome como está no cartão.";
  }
  const expiryProblem = expiryError(expiry, new Date());
  if (expiryProblem) {
    errors.expiry = expiryProblem;
  }
  if (cvv.length !== cvvLength(brand)) {
    errors.cvv = `O código tem ${cvvLength(brand)} dígitos.`;
  }

  return errors;
}

/**
 * Card fields live only in this component's state and the request body. They are wiped before the
 * reducer hears the response, success or failure, so nothing that outlives this render (reducer,
 * query cache, storage, DOM) ever holds a number. The preview draws the same state, so it empties
 * with the form.
 */
export function CardStep({
  token,
  amount,
  installmentOptions,
  subscriptionPlan,
  declined,
  send,
}: Props) {
  const [number, setNumber] = useState("");
  const [holder, setHolder] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [installments, setInstallments] = useState(1);
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCvvFocused, setIsCvvFocused] = useState(false);
  // One key per card tried: a retry of the same submit replays, a new card after a decline is a
  // new attempt.
  const idempotencyKey = useRef(crypto.randomUUID());

  const brand = brandOf(number);
  const chosen = installmentOptions.find((option) => option.count === installments);
  const total = chosen?.total ?? amount;

  function clearCard() {
    setNumber("");
    setHolder("");
    setExpiry("");
    setCvv("");
    setTouched({});
    setErrors({});
  }

  function revalidate(field: FieldName) {
    const next = { ...touched, [field]: true };
    setTouched(next);
    const all = validate(number, holder, expiry, cvv, brand);
    setErrors(Object.fromEntries(Object.entries(all).filter(([name]) => next[name as FieldName])));
  }

  async function submit(formEvent: FormEvent) {
    formEvent.preventDefault();
    const all = validate(number, holder, expiry, cvv, brand);
    setTouched({ number: true, holder: true, expiry: true, cvv: true });
    setErrors(all);
    if (Object.keys(all).length > 0) {
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
      const payment = await createAttempt(token, body, idempotencyKey.current);
      clearCard();
      idempotencyKey.current = crypto.randomUUID();
      send({ type: "attempt_created", payment });
    } catch (e) {
      clearCard();
      idempotencyKey.current = crypto.randomUUID();
      setSubmitError(messageFor(e));
      send(failureEvent(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  const message = submitError ?? declined;
  const errorProps = (field: FieldName) =>
    errors[field] ? { "aria-invalid": true as const, "aria-describedby": `${field}-error` } : {};

  return (
    <section>
      <h2
        data-step-heading
        tabIndex={-1}
        className="mb-4 font-display text-lg font-semibold outline-none"
      >
        Pagar com cartão
      </h2>

      <CardPreview
        digits={number}
        holder={holder}
        expiry={expiry}
        cvvLength={cvvLength(brand)}
        cvvTyped={cvv.length}
        brand={brand}
        flipped={isCvvFocused}
      />

      {subscriptionPlan !== undefined && (
        <p className="mt-4 rounded-xl bg-surface-muted p-3 text-sm">
          Este cartão fica salvo para as próximas cobranças
          {subscriptionPlan ? ` de ${subscriptionPlan}` : " da assinatura"}. Você pode cancelar a
          assinatura com a loja quando quiser.
        </p>
      )}

      {message && (
        <div role="alert" className="mt-4 rounded-xl bg-warn-bg p-3 text-sm text-warn-fg">
          <p>{message}</p>
          {declined && (
            <button
              type="button"
              className="mt-2 font-semibold underline underline-offset-2"
              onClick={() => send({ type: "back" })}
            >
              Escolher outra forma de pagamento
            </button>
          )}
        </div>
      )}

      <form noValidate className="mt-5" onSubmit={(formEvent) => void submit(formEvent)}>
        <fieldset disabled={isSubmitting} className="flex flex-col gap-4">
          <Field
            label="Número do cartão"
            htmlFor="card-number"
            error={errors.number}
            errorId="number-error"
            hint={brand ? BRAND_LABELS[brand] : undefined}
          >
            <input
              id="card-number"
              name="cardnumber"
              inputMode="numeric"
              autoComplete="cc-number"
              value={groupDigits(number, brand)}
              onChange={(change) =>
                setNumber(
                  digitsOf(
                    change.target.value,
                    maxDigits(brandOf(digitsOf(change.target.value, 19))),
                  ),
                )
              }
              onBlur={() => revalidate("number")}
              className={INPUT_CLASSES}
              {...errorProps("number")}
            />
          </Field>
          <Field
            label="Nome impresso no cartão"
            htmlFor="card-holder"
            error={errors.holder}
            errorId="holder-error"
          >
            <input
              id="card-holder"
              name="ccname"
              autoComplete="cc-name"
              autoCapitalize="characters"
              value={holder}
              onChange={(change) => setHolder(change.target.value.toUpperCase())}
              onBlur={() => revalidate("holder")}
              className={INPUT_CLASSES}
              {...errorProps("holder")}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Validade (MM/AA)"
              htmlFor="card-expiry"
              error={errors.expiry}
              errorId="expiry-error"
            >
              <input
                id="card-expiry"
                name="cc-exp"
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/AA"
                maxLength={5}
                value={expiry}
                onChange={(change) => setExpiry(formatExpiry(change.target.value))}
                onBlur={() => revalidate("expiry")}
                className={INPUT_CLASSES}
                {...errorProps("expiry")}
              />
            </Field>
            <Field label="CVV" htmlFor="card-cvv" error={errors.cvv} errorId="cvv-error">
              <input
                id="card-cvv"
                name="cvc"
                inputMode="numeric"
                autoComplete="cc-csc"
                maxLength={cvvLength(brand)}
                value={cvv}
                onChange={(change) => setCvv(digitsOf(change.target.value, cvvLength(brand)))}
                onFocus={() => setIsCvvFocused(true)}
                onBlur={() => {
                  setIsCvvFocused(false);
                  revalidate("cvv");
                }}
                className={INPUT_CLASSES}
                {...errorProps("cvv")}
              />
            </Field>
          </div>

          {installmentOptions.length > 1 ? (
            <Field label="Parcelas" htmlFor="card-installments">
              <select
                id="card-installments"
                value={installments}
                onChange={(change) => setInstallments(Number(change.target.value))}
                className={INPUT_CLASSES}
              >
                {installmentOptions.map((option) => (
                  <option key={option.count} value={option.count}>
                    {optionLabel(option)}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <p className="text-sm text-muted">Pagamento à vista.</p>
          )}

          <button type="submit" className={`${buttonClasses("primary", "lg")} gap-2`}>
            {isSubmitting && (
              <span
                aria-hidden="true"
                className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
            )}
            {isSubmitting ? "Processando…" : `Pagar ${formatBrl(total)}`}
          </button>
          <button
            type="button"
            className="text-sm text-muted underline underline-offset-2 hover:text-ink"
            onClick={() => send({ type: "back" })}
          >
            Voltar
          </button>
        </fieldset>
      </form>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted">
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        Pagamento seguro. Os dados do cartão não ficam salvos nesta página.
      </p>
    </section>
  );
}
