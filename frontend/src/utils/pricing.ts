/**
 * EV Charging pricing calculation utilities.
 * Production-ready module for amount ↔ units conversion, GST, and revenue split.
 *
 * PRICING CONSTANTS:
 * - Base price per unit: ₹20/kWh
 * - GST: 18% (on subtotal)
 * - Platform fee: 12% (on base amount only)
 * - Owner revenue: 88% of base amount
 *
 * USAGE:
 *
 * 1. User enters ₹100 (GST included):
 *    const result = calculateFromAmount(100);
 *    // Returns: { totalAmount: 100, baseAmount: 84.75, gstAmount: 15.25, units: 4.24 }
 *
 * 2. User enters 5 units (kWh):
 *    const result = calculateFromUnits(5);
 *    // Returns: { totalAmount: 118, baseAmount: 100, gstAmount: 18, units: 5 }
 *
 * 3. Calculate revenue split after session completes:
 *    const { platformFee, ownerRevenue } = calculateRevenueSplit(100);
 *    // Returns: { platformFee: 12, ownerRevenue: 88 }
 */

const PRICE_PER_UNIT = 20; // ₹/kWh
const GST_RATE = 0.18; // 18%
const PLATFORM_FEE_RATE = 0.12; // 12%
const MIN_AMOUNT = 10; // ₹

/**
 * Round value to 2 decimal places using string-based approach to avoid floating-point errors.
 */
function round2(value: number): number {
  return parseFloat(value.toFixed(2));
}

/**
 * Validates charging amount.
 * @throws Error if amount is invalid
 */
export function validateAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount >= MIN_AMOUNT;
}

/**
 * Validates units (kWh).
 * @throws Error if units is invalid
 */
export function validateUnits(units: number): boolean {
  return Number.isFinite(units) && units > 0;
}

/**
 * Calculate from total amount (GST INCLUDED).
 *
 * Formula:
 * - baseAmount = totalAmount / 1.18
 * - gstAmount = totalAmount - baseAmount
 * - units = baseAmount / 20
 *
 * @param totalAmount - User-entered amount (GST inclusive), in ₹
 * @returns Calculation result: { totalAmount, baseAmount, gstAmount, units }
 */
export function calculateFromAmount(totalAmount: number): {
  totalAmount: number;
  baseAmount: number;
  gstAmount: number;
  units: number;
} {
  if (!validateAmount(totalAmount)) {
    return { totalAmount: 0, baseAmount: 0, gstAmount: 0, units: 0 };
  }

  const baseAmount = round2(totalAmount / (1 + GST_RATE));
  const gstAmount = round2(totalAmount - baseAmount);
  const units = round2(baseAmount / PRICE_PER_UNIT);

  return { totalAmount: round2(totalAmount), baseAmount, gstAmount, units };
}

/**
 * Calculate from units (kWh).
 *
 * Formula:
 * - baseAmount = units * 20
 * - gstAmount = baseAmount * 0.18
 * - totalAmount = baseAmount + gstAmount
 *
 * @param units - Charging units (kWh) entered by user
 * @returns Calculation result: { units, baseAmount, gstAmount, totalAmount }
 */
export function calculateFromUnits(units: number): {
  units: number;
  baseAmount: number;
  gstAmount: number;
  totalAmount: number;
} {
  if (!validateUnits(units)) {
    return { units: 0, baseAmount: 0, gstAmount: 0, totalAmount: 0 };
  }

  const baseAmount = round2(units * PRICE_PER_UNIT);
  const gstAmount = round2(baseAmount * GST_RATE);
  const totalAmount = round2(baseAmount + gstAmount);

  return { units: round2(units), baseAmount, gstAmount, totalAmount };
}

/**
 * Calculate revenue split (run after session completion).
 *
 * Formula:
 * - platformFee = baseAmount * 0.12
 * - ownerRevenue = baseAmount * 0.88
 *
 * @param baseAmount - Pre-tax energy bill amount
 * @returns { platformFee, ownerRevenue }
 */
export function calculateRevenueSplit(baseAmount: number): {
  platformFee: number;
  ownerRevenue: number;
} {
  const platformFee = round2(baseAmount * PLATFORM_FEE_RATE);
  const ownerRevenue = round2(baseAmount * (1 - PLATFORM_FEE_RATE));

  return { platformFee, ownerRevenue };
}

/**
 * Get pre-authorization amount for payment gateway.
 * Uses exact value to 2 decimals (no round-up to next rupee).
 *
 * @param totalAmount - Amount including GST
 * @returns Amount for pre-auth rounded to 2 decimals
 *
 * @example
 * getPreauthAmount(23.56) // Returns 23.56
 */
export function getPreauthAmount(totalAmount: number): number {
  return round2(totalAmount);
}

/**
 * Calculate running/live amount as user charges.
 * Used during active sessions to show real-time billing.
 *
 * @param energyConsumedKwh - Energy consumed so far
 * @returns { baseAmount, gstAmount, totalAmount }
 */
export function calculateRunningAmount(energyConsumedKwh: number): {
  baseAmount: number;
  gstAmount: number;
  totalAmount: number;
} {
  return calculateFromUnits(energyConsumedKwh);
}

/**
 * Combine calculation results for UI display.
 * Useful for showing full cost breakdown.
 */
export interface ChargingCalculation {
  amount: number; // What user input (₹ or kWh)
  mode: 'AMOUNT' | 'UNITS';
  totalAmount: number;
  baseAmount: number;
  gstAmount: number;
  units: number;
  platformFee: number;
  ownerRevenue: number;
  preauthAmount: number;
}

/**
 * Get complete calculation result for a given amount.
 * Includes revenue split and pre-auth info.
 */
export function getCompleteCalculation(totalAmount: number): ChargingCalculation {
  const calc = calculateFromAmount(totalAmount);
  const revenue = calculateRevenueSplit(calc.baseAmount);

  return {
    amount: totalAmount,
    mode: 'AMOUNT',
    totalAmount: calc.totalAmount,
    baseAmount: calc.baseAmount,
    gstAmount: calc.gstAmount,
    units: calc.units,
    platformFee: revenue.platformFee,
    ownerRevenue: revenue.ownerRevenue,
    preauthAmount: getPreauthAmount(calc.totalAmount),
  };
}
