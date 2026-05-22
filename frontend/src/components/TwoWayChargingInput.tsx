/**
 * TwoWayChargingInput Component
 *
 * Allows users to enter charging amount OR units, with real-time bidirectional sync.
 * Prevents infinite re-render loops with debounce and controlled state.
 *
 * FEATURES:
 * - Switch between amount (₹) and units (kWh) input modes
 * - 300ms debounce for smooth UX
 * - Real-time calculation and display
 * - Validation for minimum amount (₹10)
 * - Clear cost breakdown display
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { calculateFromAmount, calculateFromUnits } from '../utils/pricing';

interface TwoWayChargingInputProps {
  /** Callback when calculation changes */
  onChange?: (data: {
    totalAmount: number;
    baseAmount: number;
    gstAmount: number;
    units: number;
    preauthAmount: number;
  }) => void;
  /** Initial amount (₹) */
  initialAmount?: number;
  /** Show detailed breakdown */
  showBreakdown?: boolean;
  /** Custom class names */
  className?: string;
}

export const TwoWayChargingInput: React.FC<TwoWayChargingInputProps> = ({
  onChange,
  initialAmount = 100,
  showBreakdown = true,
  className = '',
}) => {
  // Input mode: 'amount' (₹) or 'units' (kWh)
  const [mode, setMode] = useState<'amount' | 'units'>('amount');

  // Direct input values (as strings for controlled input)
  const [amountStr, setAmountStr] = useState(String(initialAmount));
  const [unitsStr, setUnitsStr] = useState('');

  // Debounce timer reference
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Calculate units when amount changes
  useEffect(() => {
    if (mode === 'amount' && amountStr) {
      // Clear previous timer
      if (debounceRef.current) clearTimeout(debounceRef.current);

      // Set new timer
      debounceRef.current = setTimeout(() => {
        const amount = parseFloat(amountStr);
        if (amount > 0) {
          const calc = calculateFromAmount(amount);
          setUnitsStr(calc.units.toFixed(2));
          notifyChange(calc);
        }
      }, 300); // 300ms debounce
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [amountStr, mode]);

  // Calculate amount when units change
  useEffect(() => {
    if (mode === 'units' && unitsStr) {
      // Clear previous timer
      if (debounceRef.current) clearTimeout(debounceRef.current);

      // Set new timer
      debounceRef.current = setTimeout(() => {
        const units = parseFloat(unitsStr);
        if (units > 0) {
          const calc = calculateFromUnits(units);
          setAmountStr(calc.totalAmount.toFixed(2));
          notifyChange(calc);
        }
      }, 300); // 300ms debounce
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [unitsStr, mode]);

  // Notify parent component of changes
  const notifyChange = useCallback(
    (calc: ReturnType<typeof calculateFromAmount>) => {
      if (onChange) {
        onChange({
          totalAmount: calc.totalAmount,
          baseAmount: calc.baseAmount,
          gstAmount: calc.gstAmount,
          units: calc.units,
          preauthAmount: Math.ceil(calc.totalAmount),
        });
      }
    },
    [onChange],
  );

  const currentAmount = parseFloat(amountStr) || 0;
  const currentUnits = parseFloat(unitsStr) || 0;

  // Get current calculation for display
  const calc = mode === 'amount' 
    ? calculateFromAmount(currentAmount) 
    : calculateFromUnits(currentUnits);

  return (
    <div className={`charging-input-container ${className}`}>
      {/* Mode Selector Tabs */}
      <div className="mode-selector mb-4 flex gap-2">
        <button
          onClick={() => setMode('amount')}
          className={`px-4 py-2 rounded font-medium transition ${
            mode === 'amount'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          💰 Amount (₹)
        </button>
        <button
          onClick={() => setMode('units')}
          className={`px-4 py-2 rounded font-medium transition ${
            mode === 'units'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          ⚡ Units (kWh)
        </button>
      </div>

      {/* Input Section */}
      <div className="input-section mb-6 p-4 border-2 border-blue-400 rounded-lg bg-white">
        {mode === 'amount' ? (
          <div className="amount-input">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter Charging Amount (Including GST)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">₹</span>
              <input
                type="number"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0"
                min="10"
                step="0.01"
                className="flex-1 text-3xl font-bold border-b-2 border-blue-400 outline-none py-2"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">Minimum: ₹10</p>
          </div>
        ) : (
          <div className="units-input">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter Units (kWh)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={unitsStr}
                onChange={(e) => setUnitsStr(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
                className="flex-1 text-3xl font-bold border-b-2 border-blue-400 outline-none py-2"
              />
              <span className="text-2xl font-bold">kWh</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">Must be greater than 0</p>
          </div>
        )}
      </div>

      {/* Results Display */}
      <div className="results mb-6 p-4 bg-blue-50 rounded-lg">
        <div className="text-center mb-4">
          <p className="text-sm text-gray-600">Total (Including GST)</p>
          <p className="text-4xl font-bold text-blue-600">
            ₹ {calc.totalAmount.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Pre-auth: ₹{Math.ceil(calc.totalAmount)}
          </p>
        </div>

        {calc.units > 0 && (
          <div className="text-center">
            <p className="text-sm text-gray-600">Approx. Units</p>
            <p className="text-2xl font-semibold text-blue-600">
              {calc.units.toFixed(2)} kWh
            </p>
          </div>
        )}
      </div>

      {/* Breakdown (Optional) */}
      {showBreakdown && (
        <div className="breakdown p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-3">Cost Breakdown</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Base Amount (ex-GST)</span>
              <span className="font-medium">₹ {calc.baseAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">GST (18%)</span>
              <span className="font-medium">₹ {calc.gstAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t-2 border-gray-300 pt-2">
              <span className="font-semibold">Total (incl. GST)</span>
              <span className="font-bold text-blue-600">₹ {calc.totalAmount.toFixed(2)}</span>
            </div>

            {/* Revenue split info */}
            <div className="mt-4 p-3 bg-green-50 rounded border border-green-200">
              <p className="text-xs text-gray-600 mb-2">Revenue Distribution:</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Platform Fee (12%)</span>
                  <span className="font-medium">₹ {(calc.baseAmount * 0.12).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Owner Revenue (88%)</span>
                  <span className="font-medium">₹ {(calc.baseAmount * 0.88).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TwoWayChargingInput;
