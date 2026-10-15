/** Log client errors to the browser console (DevTools → Console). */
export function logClientError(
  area: string,
  error: unknown,
  context?: Record<string, unknown>,
) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(`[Murandasi] ${area}`, {
    message,
    stack,
    ...context,
  });
}
