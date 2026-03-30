/**
 * UI formatting utilities — security-safe display functions.
 */

/**
 * Masks an IBAN showing only first 4 and last 4 characters.
 * Example: 'IT60X0542811101000000123456' → 'IT60 **** **** 3456'
 */
export function maskIBAN(iban: string | null | undefined): string {
  if (!iban) return "—";
  const clean = iban.replace(/\s/g, "");
  if (clean.length < 8) return "****";
  const first4 = clean.slice(0, 4);
  const last4 = clean.slice(-4);
  return `${first4} **** **** ${last4}`;
}

/**
 * Formats a number as Italian currency.
 * Example: 10000 → '10.000,00 EUR'
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return "€ " + new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats a date string or Date object as DD/MM/YYYY (Italian).
 */
export function formatDateIT(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Returns a human-readable relative time string in Italian.
 * Examples: '2h fa', '3 giorni fa', 'adesso'
 */
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";

  const now = Date.now();
  const diffMs = now - d.getTime();

  if (diffMs < 0) return "adesso";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "adesso";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m fa`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h fa`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} giorn${days === 1 ? "o" : "i"} fa`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mes${months === 1 ? "e" : "i"} fa`;

  const years = Math.floor(months / 12);
  return `${years} ann${years === 1 ? "o" : "i"} fa`;
}
