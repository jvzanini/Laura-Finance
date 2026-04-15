package pluggy

import "errors"

// Sentinelas para mapeamento de erros HTTP da API Pluggy.
var (
	// ErrPluggyAuthFailed indica credenciais inválidas (HTTP 401/403).
	// Não-retryable — operador precisa revisar PLUGGY_CLIENT_ID/SECRET.
	ErrPluggyAuthFailed = errors.New("pluggy: auth failed")

	// ErrPluggyRateLimited indica throttling (HTTP 429). Retryable.
	ErrPluggyRateLimited = errors.New("pluggy: rate limited")

	// ErrPluggyNotFound indica recurso inexistente (HTTP 404).
	// Não-retryable.
	ErrPluggyNotFound = errors.New("pluggy: not found")

	// ErrPluggyInternal indica erro transitório do servidor Pluggy
	// (HTTP 5xx ou falha de rede). Retryable.
	ErrPluggyInternal = errors.New("pluggy: internal error")
)

// isRetryable diz se `err` merece retry via backoff.
func isRetryable(err error) bool {
	return errors.Is(err, ErrPluggyRateLimited) || errors.Is(err, ErrPluggyInternal)
}
