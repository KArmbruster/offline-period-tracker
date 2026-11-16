/**
 * Path prefix the app is served under. Set by next.config.ts:
 * "/offline-period-tracker" for the GitHub Pages build, "" for development
 * and for the native (mobile) build.
 */
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
