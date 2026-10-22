// Minimal fetch wrapper: attaches the session token, parses the API's error
// shape into ApiError, and signs the user out when the token is rejected.

const TOKEN_KEY = "bookleaf.token";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: { field: string | null; message: string }[];

  constructor(status: number, code: string, message: string, details?: ApiError["details"]) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  // Field-level messages from VALIDATION_ERROR responses, keyed by field name.
  fieldErrors(): Record<string, string> {
    return Object.fromEntries((this.details ?? []).filter((d) => d.field).map((d) => [d.field!, d.message]));
  }
}

let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token: string | null) => {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Storage unavailable (private mode); the session just won't persist.
    }
  },
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = tokenStore.get();
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Can't reach BookLeaf right now. Check your connection and try again.");
  }

  if (response.status === 401 && token) onUnauthorized();

  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const err = data?.error;
    throw new ApiError(
      response.status,
      err?.code ?? "UNKNOWN",
      err?.message ?? `Request failed (${response.status})`,
      err?.details,
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
};
