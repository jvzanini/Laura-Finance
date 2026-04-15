package obs

// Códigos de erro canônicos da API Laura Finance.
// Mantém estabilidade de contrato — clients podem mapear por código.
const (
	CodeValidationFailed       = "VALIDATION_FAILED"
	CodeAuthInvalidCredentials = "AUTH_INVALID_CREDENTIALS"
	CodeAuthTokenExpired       = "AUTH_TOKEN_EXPIRED"
	CodeForbidden              = "FORBIDDEN"
	CodeNotFound               = "NOT_FOUND"
	CodeConflict               = "CONFLICT"
	CodeRateLimited            = "RATE_LIMITED"
	CodeInternal               = "INTERNAL"
	CodeDBTimeout              = "DB_TIMEOUT"
	CodeLLMProviderDown        = "LLM_PROVIDER_DOWN"
	CodeDependencyDown         = "DEPENDENCY_DOWN"
)

// defaultMessages mapeia cada código para uma mensagem em PT-BR segura para
// exposição ao usuário final (sem detalhes sensíveis).
var defaultMessages = map[string]string{
	CodeValidationFailed:       "Dados inválidos na requisição.",
	CodeAuthInvalidCredentials: "Credenciais inválidas.",
	CodeAuthTokenExpired:       "Sessão expirada. Faça login novamente.",
	CodeForbidden:              "Acesso negado.",
	CodeNotFound:               "Recurso não encontrado.",
	CodeConflict:               "Conflito com o estado atual do recurso.",
	CodeRateLimited:            "Muitas requisições. Tente novamente em instantes.",
	CodeInternal:               "Erro interno. Tente novamente.",
	CodeDBTimeout:              "Tempo de resposta do banco excedido.",
	CodeLLMProviderDown:        "Provedor de IA indisponível no momento.",
	CodeDependencyDown:         "Dependência externa indisponível.",
}

// messageFor retorna a mensagem PT-BR canônica para o código informado.
// Em caso de código desconhecido, devolve a mensagem do CodeInternal.
func messageFor(code string) string {
	if msg, ok := defaultMessages[code]; ok {
		return msg
	}
	return defaultMessages[CodeInternal]
}
