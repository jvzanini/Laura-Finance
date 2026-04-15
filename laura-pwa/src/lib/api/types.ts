export type ApiErrorCode =
  | "VALIDATION_FAILED" | "AUTH_INVALID_CREDENTIALS" | "AUTH_TOKEN_EXPIRED"
  | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMITED"
  | "INTERNAL" | "DB_TIMEOUT" | "LLM_PROVIDER_DOWN" | "DEPENDENCY_DOWN";

export interface ApiErrorPayload {
  error: { code: ApiErrorCode; message: string; request_id: string; timestamp: string };
}

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public requestId: string,
    public timestamp: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
