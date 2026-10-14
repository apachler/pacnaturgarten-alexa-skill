/**
 * What an API failure means for the skill. The API answers RFC 9457 problems
 * `{type, title, status, code, detail}`; the codes are listed in docs/API.md → Errors.
 */
export type ApiErrorKind =
  /** No token, or the API refuses it: ask to (re)link the account. */
  | 'unlinked'
  /** The account is linked but not (or no longer) an approved Gefährte. */
  | 'not_companion'
  /** Timeout, network, 429, 5xx: try the cache, otherwise a friendly "not reachable". */
  | 'unavailable'
  | 'not_found'
  /** 400: a bug in the skill (bad parameter). */
  | 'invalid';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(`${kind}${status ? ` (${status}${code ? ` ${code}` : ''})` : ''}`);
    this.name = 'ApiError';
  }
}

export function errorFromResponse(status: number, body: string): ApiError {
  let code: string | undefined;
  try {
    const problem: unknown = JSON.parse(body);
    if (problem && typeof problem === 'object' && typeof (problem as { code?: unknown }).code === 'string') {
      code = (problem as { code: string }).code;
    }
  } catch {
    // not JSON (proxy error page): the status decides
  }
  if (status === 401) return new ApiError('unlinked', status, code);
  if (status === 403) return new ApiError(code === 'insufficient_scope' ? 'unlinked' : 'not_companion', status, code);
  if (status === 404) return new ApiError('not_found', status, code);
  if (status === 400) return new ApiError('invalid', status, code);
  return new ApiError('unavailable', status, code);
}
