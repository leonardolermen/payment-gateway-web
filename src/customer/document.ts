export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function isCpfOrCnpjShape(value: string): boolean {
  const length = onlyDigits(value).length;
  return length === 11 || length === 14;
}

// Same mask the API applies to responses, so what the user just typed reads like what comes back.
// Anything that is not 11 or 14 digits (including an already masked value) is returned as is.
export function maskDocument(digitsOrMasked: string): string {
  const digits = onlyDigits(digitsOrMasked);

  if (digits.length === 11) {
    return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
  }

  if (digits.length === 14) {
    return `**.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-**`;
  }

  return digitsOrMasked;
}
