import { Button } from "../../support/ui/Button";
import type { StoredSecret } from "./storedSecret";

export function RemoveOrKeep({ label, secret }: { label: string; secret: StoredSecret }) {
  if (!secret.isSet || !secret.onRemove || !secret.onKeep) {
    return null;
  }

  return secret.removed ? (
    <Button variant="ghost" size="sm" aria-label={`Manter ${label}`} onClick={secret.onKeep}>
      Manter
    </Button>
  ) : (
    <Button variant="ghost" size="sm" aria-label={`Remover ${label}`} onClick={secret.onRemove}>
      Remover
    </Button>
  );
}
