const VIN_CHARS = /^[A-HJ-NPR-Z0-9]+$/;
const TRANSLIT: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5,
  P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

export const normalizeVin = (vin: string) => vin.replace(/[\s-]/g, "").toUpperCase();

/** North American check digit (position 9). Non-NA VINs may legitimately fail it. */
export function vinCheckDigitValid(vin: string): boolean {
  if (vin.length !== 17 || !VIN_CHARS.test(vin)) return false;
  const sum = [...vin].reduce((acc, ch, i) => acc + (/\d/.test(ch) ? Number(ch) : TRANSLIT[ch]) * WEIGHTS[i], 0);
  const check = sum % 11 === 10 ? "X" : String(sum % 11);
  return vin[8] === check;
}

/** Returns an error message, or null if the VIN is acceptable for the model year. */
export function vinError(vin: string, year?: number | null): string | null {
  if (!VIN_CHARS.test(vin)) return "VIN may only contain letters and digits (no I, O or Q)";
  // 17-character VINs are standard from model year 1981; older vehicles used shorter serials.
  if ((year == null || year >= 1981) && vin.length !== 17) return "VIN must be 17 characters";
  if (vin.length > 17) return "VIN must be 17 characters or fewer";
  return null;
}
