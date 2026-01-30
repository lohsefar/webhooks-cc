/**
 * HTTP-related utility functions.
 */

/** Valid HTTP status code range */
const MIN_STATUS_CODE = 100;
const MAX_STATUS_CODE = 599;

/**
 * Parses a string value into an HTTP status code.
 * Returns the default value if parsing fails, value is NaN,
 * or the value is outside the valid HTTP status code range (100-599).
 *
 * @param value - String representation of a status code
 * @param defaultValue - Default status code if parsing fails (default: 200)
 * @returns A valid HTTP status code number
 */
export function parseStatusCode(value: string, defaultValue = 200): number {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < MIN_STATUS_CODE || parsed > MAX_STATUS_CODE) {
    return defaultValue;
  }
  return parsed;
}
