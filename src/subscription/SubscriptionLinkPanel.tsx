import { CheckoutLinkPanel } from "../order/CheckoutLinkPanel";
import type { Order } from "../order/types";
import { Button } from "../support/ui/Button";
import { Card } from "../support/ui/Card";

type Props = { firstOrder: Order; onDone: () => void };

// A card subscription without a saved card waits for the payer to register one through this link.
// The gateway hands the link out once. It comes from the form's state, never from the query
// cache, and both mutations that carry it (create and rotate) are dropped when the panel unmounts.
export function SubscriptionLinkPanel({ firstOrder, onDone }: Props) {
  return (
    <Card>
      <div className="space-y-4">
        <h2 className="font-display text-[15px] font-semibold">Assinatura criada</h2>
        <p className="text-sm text-muted">
          Ela começa quando o pagador cadastrar o cartão. Envie este link: ele só aparece agora.
        </p>

        <CheckoutLinkPanel order={firstOrder} initialUrl={firstOrder.checkout_url} />

        <Button onClick={onDone}>Ver assinatura</Button>
      </div>
    </Card>
  );
}
