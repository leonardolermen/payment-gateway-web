// What a write-only field knows about its stored value: only whether one exists, never the value.
export type StoredSecret = {
  isSet: boolean;
  removed?: boolean;
  onRemove?: () => void;
  onKeep?: () => void;
};

export function secretPlaceholder(secret: StoredSecret | undefined): string | undefined {
  if (secret?.removed) {
    return "será removido ao salvar";
  }

  return secret?.isSet ? "•••• definido" : undefined;
}
