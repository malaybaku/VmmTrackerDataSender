/**
 * Protocol version information
 */

/**
 * Protocol version components
 */
export const VERSION_MAJOR = 1;
export const VERSION_MINOR = 0;
export const VERSION_PATCH = 0;

/**
 * Protocol version string (calculated from components)
 */
export const VERSION_STRING = `${VERSION_MAJOR}.${VERSION_MINOR}.${VERSION_PATCH}`;

/**
 * Version bytes for binary format (reserved byte is 0)
 */
export const VERSION_BYTES = {
  major: VERSION_MAJOR,
  minor: VERSION_MINOR,
  patch: VERSION_PATCH,
  reserved: 0
} as const;
