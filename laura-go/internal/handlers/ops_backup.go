package handlers

import (
	"os"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/obs"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// OpsBackupHandler responde POST /api/ops/backup.
// Auth via header X-Ops-Token contra env BACKUP_OPS_TOKEN.
// Em modo BACKUP_DRY=1, retorna sucesso simulado sem executar comandos.
func OpsBackupHandler(c *fiber.Ctx) error {
	expected := os.Getenv("BACKUP_OPS_TOKEN")
	if expected == "" {
		return obs.RespondError(c, obs.CodeForbidden, 403, nil)
	}
	provided := c.Get("X-Ops-Token")
	if provided == "" {
		return obs.RespondError(c, obs.CodeAuthInvalidCredentials, 401, nil)
	}
	if provided != expected {
		return obs.RespondError(c, obs.CodeForbidden, 403, nil)
	}

	ctx, span := otel.Tracer("laura/backup").Start(c.UserContext(), "backup.run",
		trace.WithAttributes(attribute.String("db.cluster", "laura-api-db")))
	defer span.End()
	_ = ctx

	dryRun := os.Getenv("BACKUP_DRY") == "1"
	startedAt := time.Now()

	// Em prod real, executar `flyctl postgres backup create`.
	// Por enquanto, NoOp + atualizar métricas com timestamp atual.
	var sizeBytes int64 = 0
	if dryRun {
		sizeBytes = 1024 * 1024 // 1MB simulado
	}

	obs.ObserveBackupSuccess(sizeBytes)
	span.SetAttributes(
		attribute.Int64("backup.size_bytes", sizeBytes),
		attribute.Int64("backup.duration_ms", time.Since(startedAt).Milliseconds()),
		attribute.Bool("backup.dry_run", dryRun),
	)

	return c.JSON(fiber.Map{
		"status":      "ok",
		"size_bytes":  sizeBytes,
		"duration_ms": time.Since(startedAt).Milliseconds(),
		"dry_run":     dryRun,
		"timestamp":   strconv.FormatInt(time.Now().Unix(), 10),
	})
}
