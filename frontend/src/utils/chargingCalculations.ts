// utils/chargingCalculations.ts

export const DEFAULT_PRICE_PER_UNIT = 20; // ₹ per kWh
export const GST_RATE = 0.18;             // 18%
export const DEFAULT_PLATFORM_FEE_PERCENT = 12;
export const PREAUTH_BUFFER = 1.00;      // exact hold (no extra buffer)

function round2(value: number): number {
  return parseFloat(value.toFixed(2));
}

export interface TariffInfo {
  pricePerKwh: number;
  gstPercent: number;
  platformFeePercent?: number;
  sessionFee: number;
}

/* ================================
   AMOUNT → UNITS  (GST included)

   User enters ₹20 (total, GST inclusive):
     baseAmount = 20 / 1.18 = ₹16.95
     gstAmount  = 20 - 16.95 = ₹3.05
     units      = 16.95 / 20 = 0.85 kWh
================================ */
export function calculateFromAmount(
  totalAmount: number,
  tariff: TariffInfo
): {
  totalAmount: number;
  baseAmount: number;
  gstAmount: number;
  units: number;
} {
  const gstMultiplier = 1 + tariff.gstPercent / 100;
  const baseAmount    = round2(totalAmount / gstMultiplier);
  const gstAmount     = round2(totalAmount - baseAmount);
  const units         = round2(baseAmount / tariff.pricePerKwh);

  return { totalAmount: round2(totalAmount), baseAmount, gstAmount, units };
}

/* ================================
   UNITS → AMOUNT

   User enters 1 kWh:
     baseAmount  = 1 × ₹20 = ₹20.00
     gstAmount   = 20 × 0.18 = ₹3.60
     totalAmount = 20 + 3.60 = ₹23.60
================================ */
export function calculateFromUnits(
  units: number,
  tariff: TariffInfo
): {
  units: number;
  baseAmount: number;
  gstAmount: number;
  totalAmount: number;
} {
  const baseAmount  = round2(units * tariff.pricePerKwh);
  const gstAmount   = round2(baseAmount * (tariff.gstPercent / 100));
  const totalAmount = round2(baseAmount + gstAmount);

  return { units: round2(units), baseAmount, gstAmount, totalAmount };
}

/* ================================
   TIME → AMOUNT  (Approximation)
   Assumes charger delivers at 7.2 kW (standard AC Level 2).
================================ */
export function calculateFromTime(
  minutes: number,
  tariff: TariffInfo
): {
  units: number;
  baseAmount: number;
  gstAmount: number;
  totalAmount: number;
  estimatedKwh: number;
} {
  const ASSUMED_KW   = 7.2;
  const estimatedKwh = round2((minutes / 60) * ASSUMED_KW);
  const result       = calculateFromUnits(estimatedKwh, tariff);
  return { ...result, estimatedKwh };
}

/* ================================
   REVENUE SPLIT
   Calculated on baseAmount only (GST excluded).

   platformFee  = baseAmount × 12%
   ownerRevenue = baseAmount - platformFee  ← subtraction avoids float drift
================================ */
export function calculateRevenueSplit(baseAmount: number, platformFeePercent: number = DEFAULT_PLATFORM_FEE_PERCENT): {
  platformFee: number;
  ownerRevenue: number;
} {
  const resolvedPlatformFeePercent = Number.isFinite(platformFeePercent)
    ? Math.max(0, platformFeePercent)
    : DEFAULT_PLATFORM_FEE_PERCENT;
  const platformFee  = round2(baseAmount * (resolvedPlatformFeePercent / 100));
  const ownerRevenue = round2(baseAmount - platformFee);
  return { platformFee, ownerRevenue };
}

/* ================================
   PRE-AUTH
   Exact amount to 2 decimals (no round-up to next rupee)
================================ */
export function getPreauthAmount(totalAmount: number): number {
  return round2(totalAmount * PREAUTH_BUFFER);
}

/* ================================
   RUNNING AMOUNT  (live session)
================================ */
export function calculateRunningAmount(
  energyConsumedKwh: number,
  tariff: TariffInfo
) {
  return calculateFromUnits(energyConsumedKwh, tariff);
}
