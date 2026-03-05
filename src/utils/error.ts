
export function normalizeError(e: any): string {
  if (typeof e === 'string') return e;
  if (e?.response?.data?.message) return e.response.data.message; // Axios-like
  if (e?.response?.data?.error) return e.response.data.error;
  if (e?.message) return e.message;
  return 'Something went wrong';
}

export function logError() {
  if (__DEV__) {

  }
  // Simple console log for now, can attach Sentry/Crashlytics here later
}