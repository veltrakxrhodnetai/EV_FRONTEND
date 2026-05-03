/**
 * useChargingCalculation Hook
 *
 * React hook for managing charging amount/units calculations with state.
 * Simplifies integration into any payment form or charging UI.
 *
 * @example
 * const charging = useChargingCalculation(100);
 *
 * // Whenever user changes amount:
 * charging.setAmount(150);
 *
 * // Access calculated values:
 * console.log(charging.totalAmount); // 150
 * console.log(charging.units); // 7.5 kWh
 * console.log(charging.preauthAmount); // 150 (ceiled)
 */

import { useCallback, useState } from 'react';
import {
  calculateFromAmount,
  calculateFromUnits,
  calculateRevenueSplit,
  getPreauthAmount,
  validateAmount,
  validateUnits,
} from './pricing';

export interface ChargingState {
  // User input
  amount: number;
  units: number;

  // Calculated values
  totalAmount: number;
  baseAmount: number;
  gstAmount: number;
  preauthAmount: number;
  platformFee: number;
  ownerRevenue: number;

  // UI state
  isValid: boolean;
  error: string | null;
}

export interface UseChargingCalculationReturn extends ChargingState {
  // Setters
  setAmount: (amount: number) => void;
  setUnits: (units: number) => void;
  reset: (initialAmount?: number) => void;
}

/**
 * Hook for managing charging calculations in React components.
 * Automatically recalculates when amount or units change.
 *
 * @param initialAmount - Starting amount in ₹
 * @returns Charging state and setter functions
 */
export function useChargingCalculation(
  initialAmount: number = 100,
): UseChargingCalculationReturn {
  const [amount, setAmountState] = useState(initialAmount);
  const [units, setUnitsState] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Calculate based on current amount
  const recalculate = useCallback(
    (newAmount: number, newUnits: number) => {
      try {
        setError(null);

        if (newAmount > 0 && !validateAmount(newAmount)) {
          throw new Error('Amount must be at least ₹10');
        }

        if (newUnits > 0 && !validateUnits(newUnits)) {
          throw new Error('Units must be greater than 0');
        }

        if (newAmount > 0) {
          // User entered amount; calculate units
          const calc = calculateFromAmount(newAmount);
          return {
            amount: newAmount,
            units: calc.units,
            totalAmount: calc.totalAmount,
            baseAmount: calc.baseAmount,
            gstAmount: calc.gstAmount,
          };
        } else if (newUnits > 0) {
          // User entered units; calculate amount
          const calc = calculateFromUnits(newUnits);
          return {
            amount: calc.totalAmount,
            units: newUnits,
            totalAmount: calc.totalAmount,
            baseAmount: calc.baseAmount,
            gstAmount: calc.gstAmount,
          };
        }

        return {
          amount: 0,
          units: 0,
          totalAmount: 0,
          baseAmount: 0,
          gstAmount: 0,
        };
      } catch (err) {
        setError((err as Error).message);
        return {
          amount: newAmount,
          units: newUnits,
          totalAmount: 0,
          baseAmount: 0,
          gstAmount: 0,
        };
      }
    },
    [],
  );

  const calculated = recalculate(amount, units);
  const revenueSplit =
    calculated.baseAmount > 0 ? calculateRevenueSplit(calculated.baseAmount) : { platformFee: 0, ownerRevenue: 0 };
  const preauthAmount = getPreauthAmount(calculated.totalAmount);
  const isValid = calculated.totalAmount > 0 && !error;

  const setAmount = useCallback((newAmount: number) => {
    setAmountState(newAmount);
    setUnitsState(0); // Clear units when amount changes
  }, []);

  const setUnits = useCallback((newUnits: number) => {
    setUnitsState(newUnits);
    setAmountState(0); // Clear amount when units change
  }, []);

  const reset = useCallback((initialAmountValue: number = 100) => {
    setAmountState(initialAmountValue);
    setUnitsState(0);
    setError(null);
  }, []);

  return {
    amount: calculated.amount,
    units: calculated.units,
    totalAmount: calculated.totalAmount,
    baseAmount: calculated.baseAmount,
    gstAmount: calculated.gstAmount,
    preauthAmount,
    platformFee: revenueSplit.platformFee,
    ownerRevenue: revenueSplit.ownerRevenue,
    isValid,
    error,
    setAmount,
    setUnits,
    reset,
  };
}

export default useChargingCalculation;
