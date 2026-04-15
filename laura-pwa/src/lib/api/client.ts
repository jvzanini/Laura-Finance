import { ApiError, type ApiErrorPayload } from "./types";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    let body: ApiErrorPayload | null = null;
    try {
      body = (await res.json()) as ApiErrorPayload;
    } catch {
      // body opaque — ignora
    }
    if (body?.error) {
      throw new ApiError(
        body.error.code,
        body.error.message,
        body.error.request_id,
        body.error.timestamp,
        res.status,
      );
    }
    throw new Error(`HTTP ${res.status} (request_id=${res.headers.get("x-request-id") ?? "?"})`);
  }
  return (await res.json()) as T;
}
