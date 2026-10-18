// ─── Ethiopian Birr (ETB) Currency Utility (Backend) ───────────────────────────
// Centralized exchange rate: 1 USD ≈ 127.50 ETB (matching frontend currency.ts)
export const ETB_RATE = 127.5;

/**
 * Converts a base USD number to Ethiopian Birr
 */
export function toETB(usd: number): number {
  if (isNaN(usd) || usd === null || usd === undefined) return 0;
  return Number((usd * ETB_RATE).toFixed(2));
}

/**
 * Formats a base numeric amount (stored as USD or base value) into Ethiopian Birr (ETB)
 * Example: formatETB(129.99) -> "ETB 16,573.73"
 */
export function formatETB(amount: number, options?: { showUSD?: boolean; compact?: boolean }): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return 'ETB 0.00';
  }

  const birr = amount * ETB_RATE;

  if (options?.compact && birr >= 1000000) {
    return `ETB ${(birr / 1000000).toFixed(1)}M`;
  }
  if (options?.compact && birr >= 1000) {
    return `ETB ${(birr / 1000).toFixed(1)}K`;
  }

  const formatted = `ETB ${birr.toLocaleString('en-ET', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  if (options?.showUSD) {
    return `${formatted} (≈ $${amount.toFixed(2)})`;
  }

  return formatted;
}

/**
 * Formats a string by replacing dollar mentions "$123.45" with "ETB 15,740.00"
 */
export function formatCurrencyString(text: string): string {
  if (!text) return '';
  return text.replace(/\$(\d+(?:\.\d+)?)/g, (_, val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return `$${val}`;
    return formatETB(num);
  });
}
