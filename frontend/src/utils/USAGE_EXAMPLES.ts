/**
 * USAGE EXAMPLES - EV Charging Calculation Module
 *
 * This file demonstrates how to use the pricing utilities and components
 * throughout the application.
 */

// ============================================================================
// EXAMPLE 1: Simple Amount → Units calculation
// ============================================================================

import { calculateFromAmount, calculateFromUnits, calculateRevenueSplit, getPreauthAmount } from './pricing';

function example1_SimpleCalculation() {
  // User enters ₹100 (including GST)
  const result = calculateFromAmount(100);

  console.log('User enters: ₹100');
  console.log('System calculates:');
  console.log(`  Base Amount: ₹${result.baseAmount}`);
  console.log(`  GST (18%): ₹${result.gstAmount}`);
  console.log(`  Approx Units: ${result.units} kWh`);
  console.log(`  Pre-auth: ₹${getPreauthAmount(result.totalAmount)}`);
}

// ============================================================================
// EXAMPLE 2: Using the React Hook in a Form
// ============================================================================

import { useChargingCalculation } from '../hooks/useChargingCalculation';

function ChargingFormExample() {
  const charging = useChargingCalculation(100); // Start with ₹100

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const amount = parseFloat(e.target.value) || 0;
    charging.setAmount(amount);
  }

  function handleUnitsChange(e: React.ChangeEvent<HTMLInputElement>) {
    const units = parseFloat(e.target.value) || 0;
    charging.setUnits(units);
  }

  function handleSubmit() {
    if (!charging.isValid) {
      alert(`Error: ${charging.error}`);
      return;
    }

    // Send to backend for session creation
    submitSessionStart({
      totalAmount: charging.totalAmount,
      baseAmount: charging.baseAmount,
      gstAmount: charging.gstAmount,
      units: charging.units,
      preauthAmount: charging.preauthAmount,
    });
  }

  return (
    <form>
      <h2>Start Charging Session</h2>

      <div className="form-group">
        <label>Amount (₹, including GST):</label>
        <input type="number" value={charging.amount || ''} onChange={handleAmountChange} />
        <span>Approx units: {charging.units.toFixed(2)} kWh</span>
      </div>

      <div className="form-group">
        <label>Units (kWh):</label>
        <input type="number" value={charging.units || ''} onChange={handleUnitsChange} />
        <span>Total amount: ₹{charging.totalAmount.toFixed(2)} (including GST)</span>
      </div>

      <div className="breakdown">
        <h3>Cost Breakdown</h3>
        <p>Base: ₹{charging.baseAmount.toFixed(2)}</p>
        <p>GST (18%): ₹{charging.gstAmount.toFixed(2)}</p>
        <p>Total: ₹{charging.totalAmount.toFixed(2)}</p>
        <p>Pre-auth: ₹{charging.preauthAmount}</p>
      </div>

      {charging.error && <div className="error">{charging.error}</div>}

      <button onClick={handleSubmit} disabled={!charging.isValid}>
        Proceed to Payment
      </button>
    </form>
  );
}

// ============================================================================
// EXAMPLE 3: Using the Two-Way Component
// ============================================================================

import TwoWayChargingInput from '../components/TwoWayChargingInput';

function PaymentPageExample() {
  function handleChargingChange(data: any) {
    console.log('Charging parameters updated:', data);
    // Use data to enable/disable payment button, update UI, etc.
  }

  return (
    <div className="payment-page">
      <h1>Select Charging Amount</h1>
      <TwoWayChargingInput onChange={handleChargingChange} showBreakdown={true} />
    </div>
  );
}

// ============================================================================
// EXAMPLE 4: Backend Session Completion
// ============================================================================

/**
 * This is what happens on the backend when a session completes.
 * The calculateFinalBill() method in ChargingSessionService does this:
 *
 * private void calculateFinalBill(ChargingSession session, Tariff tariff) {
 *   double energyConsumedKwh = (meterStop - meterStart) / 1000.0;
 *   double baseAmount = energyConsumedKwh * tariff.getPricePerKwh();
 *   double totalAmount = (baseAmount + sessionFee) * 1.18;
 *
 *   double gstAmount = totalAmount * 0.18 / 1.18;
 *   double platformFee = baseAmount * 0.12;
 *   double ownerRevenue = baseAmount * 0.88;
 *
 *   session.setTotalAmount(totalAmount);
 *   session.setBaseAmount(baseAmount);
 *   session.setGstAmount(gstAmount);
 *   session.setPlatformFee(platformFee);
 *   session.setOwnerRevenue(ownerRevenue);
 * }
 */

function exampleBackendCompletion() {
  const energyConsumedKwh = 2.5;
  const pricePerKwh = 20; // ₹20/kWh
  const sessionFee = 0; // Some stations charge this

  // Calculate like backend does
  const baseAmount = energyConsumedKwh * pricePerKwh; // 50
  const subtotal = baseAmount + sessionFee; // 50
  const totalAmount = subtotal * 1.18; // 59

  const gstAmount = totalAmount * 0.18 / 1.18; // ≈ 9
  const platformFee = baseAmount * 0.12; // 6
  const ownerRevenue = baseAmount * 0.88; // 44

  console.log('Session Completed:');
  console.log(`  Energy: ${energyConsumedKwh} kWh`);
  console.log(`  Base: ₹${baseAmount}`);
  console.log(`  GST: ₹${gstAmount.toFixed(2)}`);
  console.log(`  Total: ₹${totalAmount.toFixed(2)}`);
  console.log(`  Platform Fee (goes to platform): ₹${platformFee}`);
  console.log(`  Owner Revenue: ₹${ownerRevenue}`);
  console.log(`  Verification: ${platformFee + ownerRevenue} === ${baseAmount} ✓`);
}

// ============================================================================
// EXAMPLE 5: API Response (from backend)
// ============================================================================

/**
 * When frontend calls GET /api/sessions/{id}/bill, backend returns:
 *
 * {
 *   "sessionId": 42,
 *   "vehicleNumber": "DL01AB1234",
 *   "energyConsumedKwh": 2.5,
 *   "pricePerKwh": 20,
 *   "baseAmount": 50,
 *   "gstAmount": 9,
 *   "totalAmount": 59,
 *   "platformFee": 6,
 *   "ownerRevenue": 44,
 *   "paymentMode": "ONLINE",
 *   "paymentStatus": "CAPTURED",
 *   "startedAt": "2026-04-20T10:00:00",
 *   "endedAt": "2026-04-20T11:30:00"
 * }
 */

async function exampleAPICall() {
  const response = await fetch('/api/sessions/42/bill');
  const bill = await response.json();

  console.log('Bill Details:');
  console.log(`₹${bill.baseAmount} (energy)`);
  console.log(`+ ₹${bill.gstAmount} (GST)`);
  console.log(`= ₹${bill.totalAmount} (total paid)`);
  console.log('');
  console.log('Platform gets: ₹' + bill.platformFee);
  console.log('Owner gets: ₹' + bill.ownerRevenue);
}

// ============================================================================
// EXAMPLE 6: Frontend Component Integration Pattern
// ============================================================================

/**
 * Pattern for integrating pricing into a charging options page:
 *
 * 1. Display two-way input component
 * 2. Let user select amount or units
 * 3. Real-time calculation with 300ms debounce
 * 4. Show cost breakdown transparently
 * 5. Send calculation to backend on session start
 * 6. Backend stores these values
 * 7. When session completes, backend recalculates final bill (based on actual energy)
 * 8. Frontend shows final bill breakdown to user
 */

function integrationPattern() {
  return (
    <div>
      {/* STEP 1-4: Input component handles all calculation and display */}
      <TwoWayChargingInput
        initialAmount={500}
        showBreakdown={true}
        onChange={(calculateValues) => {
          // STEP 5: This callback has the current calculation
          console.log('Current selection:', calculateValues);
          // Enable "Start Charging" button only if valid
        }}
      />

      {/* When user clicks "Start Charging", pass calculateValues to backend */}
      {/* Backend creates session with these pre-auth values */}

      {/* Later, when session completes and user views invoice: */}
      {/* Frontend shows breakdown with FINAL values from backend */}
    </div>
  );
}

// ============================================================================
// EXPORT ALL EXAMPLES FOR TESTING
// ============================================================================

export {
  example1_SimpleCalculation,
  ChargingFormExample,
  PaymentPageExample,
  exampleBackendCompletion,
  exampleAPICall,
  integrationPattern,
};

// Run with: example1_SimpleCalculation() in browser console
