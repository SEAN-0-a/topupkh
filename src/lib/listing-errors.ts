/**
 * Server actions serialize thrown/returned values; a raw object here renders
 * as "[object Object]". Prefer `message` / `error_description` (PostgREST &
 * Auth-style payloads), stringify anything else with JSON so every shape
 * ends up as readable text, and log the full object for devtools.
 */
export function formatListingError(error: unknown): string {
  console.error("Listing error payload:", error);

  // PostgREST/Auth payloads carry `message` / `error_description`; stringify
  // any other shape. Property-bag casts are to `unknown`-typed fields — the
  // runtime `typeof` line below does the real narrowing, never `any`.
  const errorMessage =
    typeof error === "string"
      ? error
      : ((error as { message?: unknown })?.message ??
        (error as { error_description?: unknown })?.error_description ??
        JSON.stringify(error));

  // a nested non-string `message` must not degrade into "[object Object]"
  return typeof errorMessage === "string" ? errorMessage : String(errorMessage);
}
