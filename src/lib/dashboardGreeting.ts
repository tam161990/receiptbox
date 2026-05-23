/** Time-of-day greeting in Europe/Riga (Latvia). */
export function getDashboardGreeting(firstName?: string | null, now = new Date()): string {
  const hour = getRigaHour(now);
  const base =
    hour >= 5 && hour < 11
      ? "Labrīt"
      : hour >= 11 && hour < 18
        ? "Labdien"
        : "Labvakar";

  const name = firstName?.trim();
  return name ? `${base}, ${name}!` : `${base}!`;
}

function getRigaHour(now: Date): number {
  const hourPart = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Riga",
    hour: "numeric",
    hour12: false,
  })
    .formatToParts(now)
    .find((p) => p.type === "hour");
  return Number(hourPart?.value ?? 12);
}
