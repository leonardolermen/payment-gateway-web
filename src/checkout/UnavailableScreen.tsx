const MESSAGES = {
  closed: "Este link de pagamento não está mais disponível.",
  not_found: "Link inválido.",
} as const;

export function UnavailableScreen({ reason }: { reason: keyof typeof MESSAGES }) {
  return (
    <div className="text-center">
      <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-neutral-bg text-neutral-fg">
        <svg
          viewBox="0 0 24 24"
          width="28"
          height="28"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5v5.5M12 16.5v.01" strokeLinecap="round" />
        </svg>
      </span>
      <p role="alert">{MESSAGES[reason]}</p>
    </div>
  );
}
