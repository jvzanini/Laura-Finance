package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
	"github.com/jvzanini/laura-finance/laura-go/internal/msgsender"
	"github.com/jvzanini/laura-finance/laura-go/internal/services"
	"golang.org/x/crypto/bcrypt"
)

var emailRe = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

// ─── POST /public/signup/start ─────────────────────────────────────────

type signupStartRequest struct {
	Name            string `json:"name"`
	Email           string `json:"email"`
	Whatsapp        string `json:"whatsapp"`
	Password        string `json:"password"`
	DesiredPlanSlug string `json:"desired_plan_slug,omitempty"`
}

type signupStartResponse struct {
	PendingID       string `json:"pending_id"`
	EmailMasked     string `json:"email_masked"`
	WhatsappMasked  string `json:"whatsapp_masked"`
	ChannelsWarning string `json:"channels_warning,omitempty"`
}

func handlePublicSignupStart(c *fiber.Ctx) error {
	var body signupStartRequest
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON inválido")
	}

	// Normaliza
	body.Name = strings.TrimSpace(body.Name)
	body.Email = strings.ToLower(strings.TrimSpace(body.Email))
	body.Whatsapp = strings.TrimSpace(body.Whatsapp)
	body.DesiredPlanSlug = strings.TrimSpace(body.DesiredPlanSlug)

	// Valida
	if len(body.Name) < 3 {
		return fiber.NewError(fiber.StatusBadRequest, "nome muito curto")
	}
	if !emailRe.MatchString(body.Email) {
		return fiber.NewError(fiber.StatusBadRequest, "email inválido")
	}
	if err := validatePassword(body.Password); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	whatsappNormalized, err := msgsender.NormalizeE164(body.Whatsapp)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "WhatsApp inválido")
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	// Unicidade: users.email, users.phone_number, pending ativo.
	if exists, err := anyActiveConflict(ctx, body.Email, whatsappNormalized); err != nil {
		slog.ErrorContext(ctx, "signup_start_conflict_check", "err", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	} else if exists {
		return fiber.NewError(fiber.StatusConflict, "email ou WhatsApp já cadastrado")
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		slog.ErrorContext(ctx, "signup_start_hash", "err", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}

	var pendingID uuid.UUID
	var desiredPlan any = nil
	if body.DesiredPlanSlug != "" {
		desiredPlan = body.DesiredPlanSlug
	}
	err = db.Pool.QueryRow(ctx,
		`INSERT INTO pending_signups (name, email, whatsapp, password_hash, desired_plan_slug, expires_at)
		 VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP + INTERVAL '1 hour')
		 RETURNING id`,
		body.Name, body.Email, whatsappNormalized, string(passwordHash), desiredPlan,
	).Scan(&pendingID)
	if err != nil {
		slog.ErrorContext(ctx, "signup_start_insert", "err", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}

	// Gera e envia OTPs (best-effort — não falha signup se envio der erro).
	channelsWarn := dispatchSignupOTPs(ctx, pendingID, body.Email, body.Name, whatsappNormalized)

	return c.Status(fiber.StatusCreated).JSON(signupStartResponse{
		PendingID:       pendingID.String(),
		EmailMasked:     maskEmail(body.Email),
		WhatsappMasked:  maskWhatsapp(whatsappNormalized),
		ChannelsWarning: channelsWarn,
	})
}

// ─── POST /public/signup/verify-email ─────────────────────────────────

type signupVerifyRequest struct {
	PendingID string `json:"pending_id"`
	Code      string `json:"code"`
}

func handlePublicSignupVerifyEmail(c *fiber.Ctx) error {
	return handleSignupVerify(c, "email")
}

func handlePublicSignupVerifyWhatsapp(c *fiber.Ctx) error {
	return handleSignupVerify(c, "whatsapp")
}

func handleSignupVerify(c *fiber.Ctx, channel string) error {
	var body signupVerifyRequest
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON inválido")
	}

	pendingID, err := uuid.Parse(body.PendingID)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "pending_id inválido")
	}
	code := strings.TrimSpace(body.Code)
	if len(code) != services.OTPLength {
		return fiber.NewError(fiber.StatusBadRequest, "código inválido")
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	// Lookup pending + validar expiração/consumo.
	var email, whatsapp string
	var consumedAt *time.Time
	var expiresAt time.Time
	err = db.Pool.QueryRow(ctx,
		`SELECT email, whatsapp, consumed_at, expires_at FROM pending_signups WHERE id = $1`,
		pendingID,
	).Scan(&email, &whatsapp, &consumedAt, &expiresAt)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "cadastro não encontrado")
	}
	if consumedAt != nil {
		return fiber.NewError(fiber.StatusConflict, "cadastro já finalizado")
	}
	if time.Now().After(expiresAt) {
		return fiber.NewError(fiber.StatusGone, "cadastro expirado")
	}

	target := email
	purpose := "signup_email"
	column := "email_verified_at"
	if channel == "whatsapp" {
		target = whatsapp
		purpose = "signup_whatsapp"
		column = "whatsapp_verified_at"
	}

	if _, err := services.VerifyOTP(ctx, channel, target, purpose, code); err != nil {
		return mapOTPError(err)
	}

	_, err = db.Pool.Exec(ctx,
		fmt.Sprintf(`UPDATE pending_signups SET %s = CURRENT_TIMESTAMP WHERE id = $1`, column),
		pendingID,
	)
	if err != nil {
		slog.ErrorContext(ctx, "signup_verify_update", "err", err, "channel", channel)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	return c.JSON(fiber.Map{"verified": true})
}

// ─── POST /public/signup/finalize ─────────────────────────────────────

type signupFinalizeRequest struct {
	PendingID string `json:"pending_id"`
}

type signupFinalizeResponse struct {
	UserID      string `json:"user_id"`
	WorkspaceID string `json:"workspace_id"`
	Email       string `json:"email"`
}

func handlePublicSignupFinalize(c *fiber.Ctx) error {
	var body signupFinalizeRequest
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON inválido")
	}
	pendingID, err := uuid.Parse(body.PendingID)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "pending_id inválido")
	}

	ctx, cancel := context.WithTimeout(c.Context(), 15*time.Second)
	defer cancel()

	var (
		name, email, whatsapp, passwordHash string
		desiredPlan                         *string
		emailVerifiedAt, whatsappVerifiedAt *time.Time
		consumedAt                          *time.Time
		expiresAt                           time.Time
	)
	err = db.Pool.QueryRow(ctx,
		`SELECT name, email, whatsapp, password_hash, desired_plan_slug,
		        email_verified_at, whatsapp_verified_at, consumed_at, expires_at
		 FROM pending_signups WHERE id = $1`,
		pendingID,
	).Scan(&name, &email, &whatsapp, &passwordHash, &desiredPlan,
		&emailVerifiedAt, &whatsappVerifiedAt, &consumedAt, &expiresAt)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "cadastro não encontrado")
	}
	if consumedAt != nil {
		return fiber.NewError(fiber.StatusConflict, "cadastro já finalizado")
	}
	if time.Now().After(expiresAt) {
		return fiber.NewError(fiber.StatusGone, "cadastro expirado")
	}
	if emailVerifiedAt == nil || whatsappVerifiedAt == nil {
		return fiber.NewError(fiber.StatusPreconditionFailed, "verificação pendente")
	}

	// Transação: workspace + user + categorias seed.
	tx, err := db.Pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		slog.ErrorContext(ctx, "signup_finalize_tx", "err", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	defer func() { _ = tx.Rollback(ctx) }()

	trialDays := trialDaysFromEnv()
	planSlug := "vip"
	if desiredPlan != nil && *desiredPlan != "" {
		planSlug = *desiredPlan
	}

	var workspaceID uuid.UUID
	err = tx.QueryRow(ctx,
		`INSERT INTO workspaces (name, subscription_status, current_plan_slug, trial_ends_at, plan_status)
		 VALUES ($1, 'trial', $2, CURRENT_TIMESTAMP + make_interval(days => $3), 'trial')
		 RETURNING id`,
		fmt.Sprintf("Workspace de %s", name), planSlug, trialDays,
	).Scan(&workspaceID)
	if err != nil {
		slog.ErrorContext(ctx, "signup_finalize_workspace", "err", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}

	var userID uuid.UUID
	err = tx.QueryRow(ctx,
		`INSERT INTO users (workspace_id, email, name, password_hash, role, phone_number, email_verified, email_verified_at)
		 VALUES ($1, $2, $3, $4, 'proprietário', $5, TRUE, CURRENT_TIMESTAMP)
		 RETURNING id`,
		workspaceID, email, name, passwordHash, whatsapp,
	).Scan(&userID)
	if err != nil {
		slog.ErrorContext(ctx, "signup_finalize_user", "err", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}

	// Seed categorias a partir de category_templates.
	if err := seedDefaultCategoriesTx(ctx, tx, workspaceID); err != nil {
		slog.ErrorContext(ctx, "signup_finalize_categories", "err", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}

	// Marca pending consumido.
	_, err = tx.Exec(ctx,
		`UPDATE pending_signups SET consumed_at = CURRENT_TIMESTAMP WHERE id = $1`,
		pendingID,
	)
	if err != nil {
		slog.ErrorContext(ctx, "signup_finalize_consume", "err", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}

	if err := tx.Commit(ctx); err != nil {
		slog.ErrorContext(ctx, "signup_finalize_commit", "err", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}

	// Email de boas-vindas best-effort.
	go func() {
		bgCtx, bgCancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer bgCancel()
		if err := services.SendTrialStartedEmail(bgCtx, email, name, planSlug); err != nil {
			slog.Warn("signup_finalize_trial_email", "err", err)
		}
	}()

	return c.Status(fiber.StatusCreated).JSON(signupFinalizeResponse{
		UserID:      userID.String(),
		WorkspaceID: workspaceID.String(),
		Email:       email,
	})
}

// ─── POST /public/signup/resend-email | /resend-whatsapp ───────────────

func handlePublicSignupResendEmail(c *fiber.Ctx) error {
	return handleSignupResend(c, "email")
}

func handlePublicSignupResendWhatsapp(c *fiber.Ctx) error {
	return handleSignupResend(c, "whatsapp")
}

func handleSignupResend(c *fiber.Ctx, channel string) error {
	var body struct {
		PendingID string `json:"pending_id"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON inválido")
	}
	pendingID, err := uuid.Parse(body.PendingID)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "pending_id inválido")
	}

	ctx, cancel := context.WithTimeout(c.Context(), 15*time.Second)
	defer cancel()

	var email, whatsapp, name string
	var consumedAt *time.Time
	var expiresAt time.Time
	err = db.Pool.QueryRow(ctx,
		`SELECT email, whatsapp, name, consumed_at, expires_at FROM pending_signups WHERE id = $1`,
		pendingID,
	).Scan(&email, &whatsapp, &name, &consumedAt, &expiresAt)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "cadastro não encontrado")
	}
	if consumedAt != nil {
		return fiber.NewError(fiber.StatusConflict, "cadastro já finalizado")
	}
	if time.Now().After(expiresAt) {
		return fiber.NewError(fiber.StatusGone, "cadastro expirado")
	}

	target := email
	purpose := "signup_email"
	if channel == "whatsapp" {
		target = whatsapp
		purpose = "signup_whatsapp"
	}

	canResend, retryAfter, err := services.CanResendOTP(ctx, channel, target, purpose)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	if !canResend {
		c.Set("Retry-After", fmt.Sprintf("%d", int(retryAfter.Seconds())))
		return fiber.NewError(fiber.StatusTooManyRequests, "aguarde antes de reenviar")
	}

	code, err := services.GenerateOTP(ctx, channel, target, purpose, &pendingID)
	if err != nil {
		slog.ErrorContext(ctx, "signup_resend_generate", "err", err, "channel", channel)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}

	if channel == "email" {
		if err := services.SendOTPEmail(ctx, email, name, code); err != nil {
			slog.WarnContext(ctx, "signup_resend_email_send", "err", err)
		}
	} else {
		if err := msgsender.SendOTPWhatsapp(ctx, whatsapp, code); err != nil {
			slog.WarnContext(ctx, "signup_resend_whatsapp_send", "err", err)
			return fiber.NewError(fiber.StatusServiceUnavailable, "canal WhatsApp indisponível. Tente novamente em instantes.")
		}
	}

	return c.JSON(fiber.Map{"ok": true})
}

// ─── Helpers internos ─────────────────────────────────────────────────

func validatePassword(p string) error {
	if len(p) < 8 {
		return fmt.Errorf("senha deve ter ao menos 8 caracteres")
	}
	var hasLetter, hasDigit bool
	for _, r := range p {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') {
			hasLetter = true
		}
		if r >= '0' && r <= '9' {
			hasDigit = true
		}
	}
	if !hasLetter || !hasDigit {
		return fmt.Errorf("senha deve conter letra e número")
	}
	return nil
}

func anyActiveConflict(ctx context.Context, email, whatsapp string) (bool, error) {
	var count int
	err := db.Pool.QueryRow(ctx,
		`SELECT
		   (SELECT COUNT(*) FROM users WHERE LOWER(email) = LOWER($1))
		   + (SELECT COUNT(*) FROM users WHERE phone_number = $2)
		   + (SELECT COUNT(*) FROM pending_signups
		      WHERE (email = $1 OR whatsapp = $2)
		        AND consumed_at IS NULL
		        AND expires_at > CURRENT_TIMESTAMP)`,
		email, whatsapp,
	).Scan(&count)
	return count > 0, err
}

func trialDaysFromEnv() int {
	if v := os.Getenv("TRIAL_DAYS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return 7
}

func mapOTPError(err error) error {
	switch err {
	case services.ErrOTPNotFound, services.ErrOTPInvalid:
		return fiber.NewError(fiber.StatusBadRequest, "código inválido")
	case services.ErrOTPExpired:
		return fiber.NewError(fiber.StatusGone, "código expirado")
	case services.ErrOTPMaxAttempts:
		return fiber.NewError(fiber.StatusTooManyRequests, "tentativas excedidas")
	default:
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
}

func maskEmail(email string) string {
	at := strings.Index(email, "@")
	if at <= 1 {
		return email
	}
	local := email[:at]
	domain := email[at:]
	if len(local) <= 2 {
		return local[:1] + "***" + domain
	}
	return local[:2] + strings.Repeat("*", len(local)-2) + domain
}

func maskWhatsapp(w string) string {
	if len(w) < 6 {
		return w
	}
	return w[:4] + strings.Repeat("*", len(w)-7) + w[len(w)-3:]
}

// dispatchSignupOTPs gera e envia OTPs para email e whatsapp.
// Falhas são logadas mas não abortam o signup (permitindo resend).
// Devolve um warning textual se algum canal falhou.
func dispatchSignupOTPs(ctx context.Context, pendingID uuid.UUID, email, name, whatsapp string) string {
	var warn string

	emailCode, err := services.GenerateOTP(ctx, "email", email, "signup_email", &pendingID)
	if err != nil {
		slog.ErrorContext(ctx, "signup_start_gen_email_otp", "err", err)
	} else {
		bgCtx, bgCancel := context.WithTimeout(context.Background(), 20*time.Second)
		go func() {
			defer bgCancel()
			if err := services.SendOTPEmail(bgCtx, email, name, emailCode); err != nil {
				slog.WarnContext(bgCtx, "signup_start_send_email", "err", err)
			}
		}()
	}

	whatsappCode, err := services.GenerateOTP(ctx, "whatsapp", whatsapp, "signup_whatsapp", &pendingID)
	if err != nil {
		slog.ErrorContext(ctx, "signup_start_gen_whatsapp_otp", "err", err)
	} else {
		sendCtx, sendCancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer sendCancel()
		if err := msgsender.SendOTPWhatsapp(sendCtx, whatsapp, whatsappCode); err != nil {
			slog.WarnContext(sendCtx, "signup_start_send_whatsapp", "err", err)
			warn = "whatsapp indisponivel no momento"
		}
	}
	return warn
}

// seedDefaultCategoriesTx cria categorias padrão a partir de
// category_templates. Fallback: sem-op se tabela vazia.
func seedDefaultCategoriesTx(ctx context.Context, tx pgx.Tx, workspaceID uuid.UUID) error {
	rows, err := tx.Query(ctx,
		`SELECT name, emoji, color, description, subcategories
		 FROM category_templates
		 WHERE active = TRUE
		 ORDER BY sort_order ASC`,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	type template struct {
		Name          string
		Emoji         string
		Color         string
		Description   *string
		Subcategories json.RawMessage
	}
	var templates []template
	for rows.Next() {
		var t template
		if err := rows.Scan(&t.Name, &t.Emoji, &t.Color, &t.Description, &t.Subcategories); err != nil {
			return err
		}
		templates = append(templates, t)
	}

	for _, t := range templates {
		var categoryID uuid.UUID
		err := tx.QueryRow(ctx,
			`INSERT INTO categories (workspace_id, name, emoji, color, description, monthly_limit_cents)
			 VALUES ($1, $2, $3, $4, $5, 0)
			 RETURNING id`,
			workspaceID, t.Name, t.Emoji, t.Color, t.Description,
		).Scan(&categoryID)
		if err != nil {
			return err
		}

		// Subcategorias
		var subs []struct {
			Name  string `json:"name"`
			Emoji string `json:"emoji"`
		}
		if len(t.Subcategories) > 0 {
			if err := json.Unmarshal(t.Subcategories, &subs); err == nil {
				for _, s := range subs {
					_, _ = tx.Exec(ctx,
						`INSERT INTO subcategories (workspace_id, category_id, name, emoji)
						 VALUES ($1, $2, $3, $4)`,
						workspaceID, categoryID, s.Name, s.Emoji,
					)
				}
			}
		}
	}
	return nil
}
