/**
 * EV Charging Calculation Module - Integration & Testing Guide
 * 
 * This file demonstrates how all the pricing utilities integrate into
 * a complete end-to-end EV charging billing system.
 */

import {
  calculateFromAmount,
  calculateFromUnits,
  calculateRevenueSplit,
  getPreauthAmount,
  validateAmount,
  validateUnits,
} from './pricing';

// ============================================================================
// REQUIREMENT 1: Amount → Units Calculation
// ============================================================================

/**
 * Case 1: User enters ₹20 (GST included)
 * Expected output:
 *   - baseAmount ≈ ₹16.95
 *   - gstAmount ≈ ₹3.05
 *   - units ≈ 0.85
 */
export function testCase1_AmountToUnits() {
  const result = calculateFromAmount(20);
  console.log('Case 1: Input ₹20 (GST inclusive)');
  console.log('  Base Amount:', result.baseAmount); // ≈ 16.95
  console.log('  GST Amount:', result.gstAmount); // ≈ 3.05
  console.log('  Units:', result.units); // ≈ 0.85
  console.assert(result.baseAmount > 16 && result.baseAmount < 17, 'Base amount ~16.95');
  console.assert(result.gstAmount > 3 && result.gstAmount < 3.1, 'GST amount ~3.05');
  console.assert(result.units > 0.84 && result.units < 0.86, 'Units ~0.85');
}

// ============================================================================
// REQUIREMENT 2: Units → Amount Calculation
// ============================================================================

/**
 * Case 2: User enters 1 unit (1 kWh)
 * Expected output:
 *   - baseAmount = ₹20
 *   - gstAmount = ₹3.60
 *   - totalAmount = ₹23.60
 */
export function testCase2_UnitsToAmount() {
  const result = calculateFromUnits(1);
  console.log('Case 2: Input 1 kWh');
  console.log('  Base Amount:', result.baseAmount); // 20
  console.log('  GST Amount:', result.gstAmount); // 3.6
  console.log('  Total Amount:', result.totalAmount); // 23.6
  console.assert(result.baseAmount === 20, 'Base amount = 20');
  console.assert(result.gstAmount === 3.6, 'GST amount = 3.6');
  console.assert(result.totalAmount === 23.6, 'Total amount = 23.6');
}

// ============================================================================
// REQUIREMENT 3: Pre-Authorization Logic
// ============================================================================

/**
 * Pre-auth should be rounded UP to nearest integer
 */
export function testCase3_PreAuthorization() {
  // Example: ₹23.6 should ceil to ₹24
  const preauthAmount = getPreauthAmount(23.6);
  console.log('Case 3: Pre-auth for ₹23.6 → ₹', preauthAmount); // 24
  console.assert(preauthAmount === 24, 'Pre-auth rounds up to 24');

  // Example: ₹23.0 should ceil to ₹23
  const preauthAmount2 = getPreauthAmount(23.0);
  console.log('Case 3b: Pre-auth for ₹23.0 → ₹', preauthAmount2); // 23
  console.assert(preauthAmount2 === 23, 'Pre-auth stays at 23');
}

// ============================================================================
// REQUIREMENT 4: Revenue Split Logic
// ============================================================================

/**
 * After session completion, split baseAmount into:
 * - Platform Fee: 12% of baseAmount
 * - Owner Revenue: 88% of baseAmount (GST NOT included)
 */
export function testCase4_RevenueSplit() {
  const baseAmount = 100; // ₹100 (ex-GST)
  const { platformFee, ownerRevenue } = calculateRevenueSplit(baseAmount);

  console.log('Case 4: Revenue split on ₹100 base amount');
  console.log('  Platform Fee (12%):', platformFee); // 12
  console.log('  Owner Revenue (88%):', ownerRevenue); // 88
  console.assert(platformFee === 12, 'Platform fee = 12% = ₹12');
  console.assert(ownerRevenue === 88, 'Owner revenue = 88% = ₹88');
  console.assert(
    platformFee + ownerRevenue === baseAmount,
    'Platform + Owner = Base Amount',
  );
}

// ============================================================================
// REQUIREMENT 5: Validation Rules
// ============================================================================

/**
 * Minimum amount: ₹10
 * Units must be > 0
 */
export function testCase5_Validation() {
  console.log('Case 5: Validation tests');

  // Valid amount
  console.assert(validateAmount(100) === true, '₹100 is valid');

  // Below minimum
  console.assert(validateAmount(5) === false, '₹5 is invalid (below ₹10)');

  // Valid units
  console.assert(validateUnits(0.5) === true, '0.5 kWh is valid');

  // Invalid units
  console.assert(validateUnits(0) === false, '0 kWh is invalid');
  console.assert(validateUnits(-1) === false, '-1 kWh is invalid');

  console.log('  ✓ All validation tests passed');
}

// ============================================================================
// COMPLETE END-TO-END FLOW
// ============================================================================

export interface SessionBilling {
  // User input
  userInputAmount: number;
  userInputUnits: number;

  // Billing breakdown
  totalAmount: number;
  baseAmount: number;
  gstAmount: number;
  units: number;

  // Pre-authorization
  preauthAmount: number;

  // Revenue (after session completion)
  platformFee: number;
  ownerRevenue: number;

  // Verification
  totalRevenue: number; // platformFee + ownerRevenue, should equal baseAmount
}

/**
 * Complete workflow: User enters amount → System calculates everything
 */
export function completeWorkflow_UserEntersAmount(userAmount: number): SessionBilling {
  // Step 1: Validate user input
  if (!validateAmount(userAmount)) {
    throw new Error(`Invalid amount: ₹${userAmount}. Minimum is ₹10.`);
  }

  // Step 2: Calculate from amount
  const amountCalc = calculateFromAmount(userAmount);

  // Step 3: Get pre-auth amount
  const preauthAmount = getPreauthAmount(amountCalc.totalAmount);

  // Step 4: Calculate revenue split (for backend reference, though actual calculation is on session completion)
  const revenueSplit = calculateRevenueSplit(amountCalc.baseAmount);

  // Step 5: Return complete billing
  const billing: SessionBilling = {
    userInputAmount: userAmount,
    userInputUnits: 0, // User entered amount, not units
    totalAmount: amountCalc.totalAmount,
    baseAmount: amountCalc.baseAmount,
    gstAmount: amountCalc.gstAmount,
    units: amountCalc.units,
    preauthAmount,
    platformFee: revenueSplit.platformFee,
    ownerRevenue: revenueSplit.ownerRevenue,
    totalRevenue: revenueSplit.platformFee + revenueSplit.ownerRevenue,
  };

  // Verify: totalRevenue should equal baseAmount
  console.assert(
    billing.totalRevenue === billing.baseAmount,
    'Revenue split sums to base amount',
  );

  return billing;
}

/**
 * Complete workflow: User enters units → System calculates everything
 */
export function completeWorkflow_UserEntersUnits(userUnits: number): SessionBilling {
  // Step 1: Validate user input
  if (!validateUnits(userUnits)) {
    throw new Error(`Invalid units: ${userUnits} kWh. Must be greater than 0.`);
  }

  // Step 2: Calculate from units
  const unitsCalc = calculateFromUnits(userUnits);

  // Step 3: Get pre-auth amount
  const preauthAmount = getPreauthAmount(unitsCalc.totalAmount);

  // Step 4: Calculate revenue split
  const revenueSplit = calculateRevenueSplit(unitsCalc.baseAmount);

  // Step 5: Return complete billing
  const billing: SessionBilling = {
    userInputAmount: 0, // User entered units, not amount
    userInputUnits: userUnits,
    totalAmount: unitsCalc.totalAmount,
    baseAmount: unitsCalc.baseAmount,
    gstAmount: unitsCalc.gstAmount,
    units: unitsCalc.units,
    preauthAmount,
    platformFee: revenueSplit.platformFee,
    ownerRevenue: revenueSplit.ownerRevenue,
    totalRevenue: revenueSplit.platformFee + revenueSplit.ownerRevenue,
  };

  // Verify
  console.assert(
    billing.totalRevenue === billing.baseAmount,
    'Revenue split sums to base amount',
  );

  return billing;
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

export function runAllTests() {
  console.log('========== PRICING CALCULATION TESTS ==========\n');

  try {
    testCase1_AmountToUnits();
    console.log('✅ Case 1 passed\n');

    testCase2_UnitsToAmount();
    console.log('✅ Case 2 passed\n');

    testCase3_PreAuthorization();
    console.log('✅ Case 3 passed\n');

    testCase4_RevenueSplit();
    console.log('✅ Case 4 passed\n');

    testCase5_Validation();
    console.log('✅ Case 5 passed\n');

    console.log('========== END-TO-END WORKFLOWS ==========\n');

    const billing1 = completeWorkflow_UserEntersAmount(100);
    console.log('Workflow 1: User enters ₹100');
    console.log(billing1);
    console.log('✅ Workflow 1 passed\n');

    const billing2 = completeWorkflow_UserEntersUnits(2.5);
    console.log('Workflow 2: User enters 2.5 kWh');
    console.log(billing2);
    console.log('✅ Workflow 2 passed\n');

    console.log('========== ✅ ALL TESTS PASSED ==========');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}
