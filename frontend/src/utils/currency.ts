const INR_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

export function formatINR(amount: number): string {
  if (!Number.isFinite(amount)) {
    return INR_FORMATTER.format(0);
  }

  return INR_FORMATTER.format(amount);
}
