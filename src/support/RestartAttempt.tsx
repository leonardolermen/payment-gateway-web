import { keyIsHeld } from "./gatewayError";
import { Button } from "./ui/Button";

type Props = { error: unknown; onRestart: () => void };

// The gateway holds the key after a 5xx (IN_PROGRESS) or refuses it for another body (REUSED):
// retrying under it never goes through. The panel cannot tell whether the first attempt landed;
// the operator checks, then starts over under a new key.
export function RestartAttempt({ error, onRestart }: Props) {
  if (!keyIsHeld(error)) {
    return null;
  }

  return (
    <Button variant="ghost" size="sm" onClick={onRestart}>
      Recomeçar
    </Button>
  );
}
