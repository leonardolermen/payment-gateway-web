const DATE_TIME = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}

const SAO_PAULO_WALL_CLOCK = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function wallClockAsUtc(instant: number): number {
  const parts = Object.fromEntries(
    SAO_PAULO_WALL_CLOCK.formatToParts(new Date(instant)).map((part) => [part.type, part.value]),
  );

  return Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
  );
}

/**
 * A datetime-local value ("2026-10-10T12:00") is a wall-clock time with no zone, and the browser
 * zone is not the merchant one. The offset is measured with Intl at that date instead of
 * hardcoded -03:00, because Brazil observed DST until 2019 and older dates would be an hour off.
 */
export function saoPauloLocalToIso(local: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) {
    return null;
  }

  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const asIfUtc = Date.UTC(year, month - 1, day, hour, minute);
  const offset = wallClockAsUtc(asIfUtc) - asIfUtc;

  return new Date(asIfUtc - offset).toISOString();
}

// Split by hand: new Date("2026-10-06") is UTC midnight and would render as the previous day in São Paulo.
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}
