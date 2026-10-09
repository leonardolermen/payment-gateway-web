import { readApiKey } from "../auth/apiKey";
import { useMerchant } from "../auth/useMerchant";
import { Badge, type BadgeTone } from "../support/ui/Badge";
import { Card } from "../support/ui/Card";

const ENVIRONMENT_TONE: Record<"TEST" | "LIVE", BadgeTone> = { TEST: "warn", LIVE: "ok" };
const ENVIRONMENT_COPY: Record<"TEST" | "LIVE", string> = {
  TEST: "Esta chave é de teste: cobranças feitas aqui não movem dinheiro.",
  LIVE: "Esta chave é de produção: cobranças feitas aqui movem dinheiro de verdade.",
};

// Twelve characters is "gk_test_" plus four: enough to tell two keys apart, never enough to use one.
function keyPrefix(): string | null {
  const key = readApiKey();
  return key ? `${key.slice(0, 12)}…` : null;
}

// When password login arrives, the key moves in here as something the merchant creates (spec §5).
export function AccountSection() {
  const merchant = useMerchant();
  const prefix = keyPrefix();

  return (
    <Card className="space-y-4">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-medium tracking-wider text-muted uppercase">Loja</dt>
          <dd className="font-medium">{merchant.data?.name ?? "…"}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium tracking-wider text-muted uppercase">Ambiente</dt>
          <dd className="space-y-1">
            {merchant.data && (
              <>
                <Badge tone={ENVIRONMENT_TONE[merchant.data.environment]}>
                  {merchant.data.environment}
                </Badge>
                <p className="text-xs text-muted">{ENVIRONMENT_COPY[merchant.data.environment]}</p>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium tracking-wider text-muted uppercase">
            Chave em uso
          </dt>
          <dd className="font-mono text-sm">{prefix ?? "—"}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted">
        Chaves são criadas e rotacionadas pelo operador do gateway. Para trocar de chave, saia e
        entre com a nova.
      </p>
    </Card>
  );
}
