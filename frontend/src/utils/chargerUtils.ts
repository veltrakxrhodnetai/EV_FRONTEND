/**
 * Connector types that are always DC (case-insensitive substring match).
 * Checked before AC so CCS/CHAdeMO are never mis-classified.
 */
const DC_CONNECTOR_KEYWORDS = ['chademo', 'ccs', 'dc', 'bharat dc', 'gbt dc', 'gb/t dc', 'tesla dc'];

/**
 * Connector type strings that indicate AC (after ruling out DC above).
 */
const AC_CONNECTOR_KEYWORDS = [
  'type 1', 'type1', 'j1772',
  'type 2', 'type2', 'iec62196', 'mennekes',
  'schuko', 'cee',
  'bharat ac', 'gb/t ac', 'gbt ac',
  'ac001',
];

/**
 * Determine whether a connector is AC.
 * Priority:
 *  1. chargerType field from the backend ("AC" / "DC")
 *  2. Explicit DC connector keywords → DC
 *  3. Explicit "AC" connector type string → AC
 *  4. Known AC connector type keywords → AC
 *  5. Power-level heuristic: ≤22 kW → AC, >22 kW → DC
 *  6. Unknown → DC
 */
export function isAcConnector(
  chargerType?: string | null,
  connectorType?: string | null,
  chargerMaxPowerKw?: number | null,
): boolean {
  // 1. Trust the charger-level type field when the backend provides it
  if (chargerType) {
    return chargerType.toUpperCase().includes('AC');
  }

  const t = (connectorType ?? '').toLowerCase().trim();

  // 2. Explicit DC connector types → not AC
  if (DC_CONNECTOR_KEYWORDS.some((kw) => t.includes(kw))) return false;

  // 3. Connector type string explicitly says "AC"
  if (t === 'ac' || t.startsWith('ac ') || t.endsWith(' ac') || t.includes('_ac') || t.includes('-ac')) return true;

  // 4. Known AC connector standards (Type 2, Type1, J1772, etc.)
  if (AC_CONNECTOR_KEYWORDS.some((kw) => t.includes(kw))) return true;

  // 5. Power-level heuristic: AC chargers are almost always ≤22 kW
  if (chargerMaxPowerKw != null && chargerMaxPowerKw > 0) {
    return chargerMaxPowerKw <= 22;
  }

  // 6. Unknown — default to DC
  return false;
}
