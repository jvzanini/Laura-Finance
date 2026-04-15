package obs

import (
	"errors"
	"testing"
	"time"
)

// Testes simples para garantir que as funções Observe* não entram em
// panic e aceitam os inputs documentados. Foco: subir coverage sem
// adicionar dependências externas.

func TestObserveLLMCall_NoError(t *testing.T) {
	ObserveLLMCall("openai", "gpt-5", 150*time.Millisecond, nil)
}

func TestObserveLLMCall_WithError(t *testing.T) {
	ObserveLLMCall("anthropic", "claude-opus", 2*time.Second, errors.New("boom"))
}

func TestObserveCronJob(t *testing.T) {
	ObserveCronJob("activity-reminders", 42*time.Millisecond)
	ObserveCronJob("backup-nightly", 5*time.Second)
}

func TestObservePgxError(t *testing.T) {
	ObservePgxError("acquire_timeout")
	ObservePgxError("query")
}

func TestObservePgxQueryDuration(t *testing.T) {
	ObservePgxQueryDuration(10 * time.Millisecond)
	ObservePgxQueryDuration(time.Second)
}

func TestObserveLLMTimeout(t *testing.T) {
	ObserveLLMTimeout("openai")
	ObserveLLMTimeout("anthropic")
}

func TestObserveBackupSuccess(t *testing.T) {
	ObserveBackupSuccess(1024 * 1024)
	ObserveBackupSuccess(0)
}
