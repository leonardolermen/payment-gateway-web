const MESSAGES = {
  closed: "Este link de pagamento não está mais disponível.",
  not_found: "Link inválido.",
} as const;

export function UnavailableScreen({ reason }: { reason: keyof typeof MESSAGES }) {
  return <p role="alert">{MESSAGES[reason]}</p>;
}
