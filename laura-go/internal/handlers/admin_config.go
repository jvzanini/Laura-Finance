package handlers

import (
	"context"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
)

// allowedOptionTables é a whitelist de tabelas permitidas para CRUD genérico.
var allowedOptionTables = map[string]bool{
	"bank_options":            true,
	"card_brand_options":      true,
	"broker_options":          true,
	"investment_type_options": true,
	"goal_templates":          true,
	"category_templates":      true,
}

// ─── System Config ───

type ConfigItem struct {
	Key         string      `json:"key"`
	Value       interface{} `json:"value"`
	Description *string     `json:"description"`
}

func handleAdminListConfig(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	rows, err := db.Pool.Query(ctx, "SELECT key, value, description FROM system_config ORDER BY key")
	if err != nil {
		log.Printf("[ERROR] handleAdminListConfig: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	defer rows.Close()

	items := []ConfigItem{}
	for rows.Next() {
		var item ConfigItem
		if err := rows.Scan(&item.Key, &item.Value, &item.Description); err != nil {
			continue
		}
		items = append(items, item)
	}
	return c.JSON(fiber.Map{"configs": items})
}

func handleAdminUpdateConfig(c *fiber.Ctx) error {
	sess := getSession(c)
	key := c.Params("key")
	if key == "" {
		return fiber.NewError(fiber.StatusBadRequest, "key obrigatória")
	}

	var body struct {
		Value interface{} `json:"value"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON inválido")
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	tag, err := db.Pool.Exec(ctx,
		"UPDATE system_config SET value = $1::jsonb, updated_at = CURRENT_TIMESTAMP, updated_by = $2 WHERE key = $3",
		mustMarshalJSON(body.Value), sess.UserID, key,
	)
	if err != nil {
		log.Printf("[ERROR] handleAdminUpdateConfig: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	if tag.RowsAffected() == 0 {
		return fiber.NewError(fiber.StatusNotFound, "config não encontrada")
	}
	return c.JSON(fiber.Map{"success": true})
}

// ─── Generic CRUD for option tables ───

func handleAdminListOptions(table string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !allowedOptionTables[table] {
			return fiber.NewError(fiber.StatusBadRequest, "tabela não permitida")
		}
		ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
		defer cancel()
		rows, err := db.Pool.Query(ctx, "SELECT row_to_json(t) FROM "+table+" t ORDER BY sort_order, name")
		if err != nil {
			log.Printf("[ERROR] handleAdminListOptions(%s): %v", table, err)
			return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
		}
		defer rows.Close()

		items := []interface{}{}
		for rows.Next() {
			var item interface{}
			if err := rows.Scan(&item); err != nil {
				continue
			}
			items = append(items, item)
		}
		return c.JSON(fiber.Map{"items": items})
	}
}

func handleAdminCreateOption(table string, requiredFields []string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !allowedOptionTables[table] {
			return fiber.NewError(fiber.StatusBadRequest, "tabela não permitida")
		}
		var body map[string]interface{}
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "JSON inválido")
		}
		for _, f := range requiredFields {
			if body[f] == nil || body[f] == "" {
				return fiber.NewError(fiber.StatusBadRequest, f+" é obrigatório")
			}
		}

		ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
		defer cancel()
		var id string

		switch table {
		case "bank_options":
			err := db.Pool.QueryRow(ctx,
				"INSERT INTO bank_options (name, slug, active, sort_order) VALUES ($1, $2, COALESCE($3, true), COALESCE($4, 0)) RETURNING id",
				body["name"], body["slug"], body["active"], body["sort_order"],
			).Scan(&id)
			if err != nil {
				log.Printf("[ERROR] handleAdminCreateOption(bank_options): %v", err)
				return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
			}
		case "card_brand_options":
			err := db.Pool.QueryRow(ctx,
				"INSERT INTO card_brand_options (name, slug, active, sort_order) VALUES ($1, $2, COALESCE($3, true), COALESCE($4, 0)) RETURNING id",
				body["name"], body["slug"], body["active"], body["sort_order"],
			).Scan(&id)
			if err != nil {
				log.Printf("[ERROR] handleAdminCreateOption(card_brand_options): %v", err)
				return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
			}
		case "broker_options":
			err := db.Pool.QueryRow(ctx,
				"INSERT INTO broker_options (name, slug, emoji, category, active, sort_order) VALUES ($1, $2, COALESCE($3, '🏦'), COALESCE($4, 'nacional'), COALESCE($5, true), COALESCE($6, 0)) RETURNING id",
				body["name"], body["slug"], body["emoji"], body["category"], body["active"], body["sort_order"],
			).Scan(&id)
			if err != nil {
				log.Printf("[ERROR] handleAdminCreateOption(broker_options): %v", err)
				return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
			}
		case "investment_type_options":
			err := db.Pool.QueryRow(ctx,
				"INSERT INTO investment_type_options (name, slug, active, sort_order) VALUES ($1, $2, COALESCE($3, true), COALESCE($4, 0)) RETURNING id",
				body["name"], body["slug"], body["active"], body["sort_order"],
			).Scan(&id)
			if err != nil {
				log.Printf("[ERROR] handleAdminCreateOption(investment_type_options): %v", err)
				return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
			}
		case "goal_templates":
			err := db.Pool.QueryRow(ctx,
				"INSERT INTO goal_templates (name, emoji, description, default_target_cents, color, sort_order, active) VALUES ($1, COALESCE($2, '🎯'), $3, COALESCE($4, 0), COALESCE($5, '#8B5CF6'), COALESCE($6, 0), COALESCE($7, true)) RETURNING id",
				body["name"], body["emoji"], body["description"], body["default_target_cents"], body["color"], body["sort_order"], body["active"],
			).Scan(&id)
			if err != nil {
				log.Printf("[ERROR] handleAdminCreateOption(goal_templates): %v", err)
				return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
			}
		default:
			return fiber.NewError(fiber.StatusBadRequest, "tabela não suportada")
		}

		return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id, "success": true})
	}
}

func handleAdminDeleteOption(table string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !allowedOptionTables[table] {
			return fiber.NewError(fiber.StatusBadRequest, "tabela não permitida")
		}
		id := c.Params("id")
		if id == "" {
			return fiber.NewError(fiber.StatusBadRequest, "id obrigatório")
		}
		ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
		defer cancel()
		tag, err := db.Pool.Exec(ctx, "DELETE FROM "+table+" WHERE id = $1", id)
		if err != nil {
			log.Printf("[ERROR] handleAdminDeleteOption(%s): %v", table, err)
			return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
		}
		if tag.RowsAffected() == 0 {
			return fiber.NewError(fiber.StatusNotFound, "não encontrado")
		}
		return c.JSON(fiber.Map{"success": true})
	}
}

func handleAdminToggleOption(table string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !allowedOptionTables[table] {
			return fiber.NewError(fiber.StatusBadRequest, "tabela não permitida")
		}
		id := c.Params("id")
		var body struct {
			Active bool `json:"active"`
		}
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "JSON inválido")
		}
		ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
		defer cancel()
		_, err := db.Pool.Exec(ctx, "UPDATE "+table+" SET active = $1 WHERE id = $2", body.Active, id)
		if err != nil {
			log.Printf("[ERROR] handleAdminToggleOption(%s): %v", table, err)
			return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
		}
		return c.JSON(fiber.Map{"success": true})
	}
}

// ─── Subscription Plans ───

func handleAdminListPlans(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	rows, err := db.Pool.Query(ctx, "SELECT row_to_json(t) FROM subscription_plans t ORDER BY sort_order")
	if err != nil {
		log.Printf("[ERROR] handleAdminListPlans: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	defer rows.Close()

	items := []interface{}{}
	for rows.Next() {
		var item interface{}
		if err := rows.Scan(&item); err != nil {
			continue
		}
		items = append(items, item)
	}
	return c.JSON(fiber.Map{"plans": items})
}

func handleAdminUpdatePlan(c *fiber.Ctx) error {
	slug := c.Params("slug")
	if slug == "" {
		return fiber.NewError(fiber.StatusBadRequest, "slug obrigatório")
	}

	var body map[string]interface{}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON inválido")
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	_, err := db.Pool.Exec(ctx,
		`UPDATE subscription_plans SET
			name = COALESCE($1, name),
			price_cents = COALESCE($2, price_cents),
			capabilities = COALESCE($3::jsonb, capabilities),
			ai_model_config = COALESCE($4::jsonb, ai_model_config),
			limits = COALESCE($5::jsonb, limits),
			features_description = COALESCE($6::jsonb, features_description),
			active = COALESCE($7, active)
		 WHERE slug = $8`,
		body["name"], body["price_cents"],
		nullableJSON(body["capabilities"]), nullableJSON(body["ai_model_config"]),
		nullableJSON(body["limits"]), nullableJSON(body["features_description"]),
		body["active"], slug,
	)
	if err != nil {
		log.Printf("[ERROR] handleAdminUpdatePlan: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	return c.JSON(fiber.Map{"success": true})
}

func nullableJSON(v interface{}) *string {
	if v == nil {
		return nil
	}
	s := string(mustMarshalJSON(v))
	return &s
}

// ─── Payment Processors Admin ───

func handleAdminListProcessors(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	rows, err := db.Pool.Query(ctx, "SELECT row_to_json(t) FROM payment_processors t ORDER BY name")
	if err != nil {
		log.Printf("[ERROR] handleAdminListProcessors: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	defer rows.Close()

	items := []interface{}{}
	for rows.Next() {
		var item interface{}
		if err := rows.Scan(&item); err != nil {
			continue
		}
		items = append(items, item)
	}
	return c.JSON(fiber.Map{"processors": items})
}

func handleAdminCreateProcessor(c *fiber.Ctx) error {
	var body struct {
		Name   string                 `json:"name"`
		Slug   string                 `json:"slug"`
		Fees   map[string]interface{} `json:"fees"`
		Active *bool                  `json:"active"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON inválido")
	}
	if body.Name == "" || body.Slug == "" {
		return fiber.NewError(fiber.StatusBadRequest, "name e slug são obrigatórios")
	}

	active := true
	if body.Active != nil {
		active = *body.Active
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	var id string
	err := db.Pool.QueryRow(ctx,
		"INSERT INTO payment_processors (name, slug, fees, active) VALUES ($1, $2, $3::jsonb, $4) RETURNING id",
		body.Name, body.Slug, string(mustMarshalJSON(body.Fees)), active,
	).Scan(&id)
	if err != nil {
		log.Printf("[ERROR] handleAdminCreateProcessor: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id, "success": true})
}

func handleAdminUpdateProcessor(c *fiber.Ctx) error {
	id := c.Params("id")
	var body struct {
		Name   *string                `json:"name"`
		Fees   map[string]interface{} `json:"fees"`
		Active *bool                  `json:"active"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON inválido")
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	_, err := db.Pool.Exec(ctx,
		`UPDATE payment_processors SET
			name = COALESCE($1, name),
			fees = COALESCE($2::jsonb, fees),
			active = COALESCE($3, active)
		 WHERE id = $4`,
		body.Name, nullableJSON(body.Fees), body.Active, id,
	)
	if err != nil {
		log.Printf("[ERROR] handleAdminUpdateProcessor: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	return c.JSON(fiber.Map{"success": true})
}

func handleAdminDeleteProcessor(c *fiber.Ctx) error {
	id := c.Params("id")
	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	tag, err := db.Pool.Exec(ctx, "DELETE FROM payment_processors WHERE id = $1", id)
	if err != nil {
		log.Printf("[ERROR] handleAdminDeleteProcessor: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	if tag.RowsAffected() == 0 {
		return fiber.NewError(fiber.StatusNotFound, "operadora não encontrada")
	}
	return c.JSON(fiber.Map{"success": true})
}

// ─── Category Templates Admin ───

func handleAdminListCategoryTemplates(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	rows, err := db.Pool.Query(ctx, "SELECT row_to_json(t) FROM category_templates t ORDER BY sort_order")
	if err != nil {
		log.Printf("[ERROR] handleAdminListCategoryTemplates: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	defer rows.Close()

	items := []interface{}{}
	for rows.Next() {
		var item interface{}
		if err := rows.Scan(&item); err != nil {
			continue
		}
		items = append(items, item)
	}
	return c.JSON(fiber.Map{"templates": items})
}

func handleAdminCreateCategoryTemplate(c *fiber.Ctx) error {
	var body struct {
		Name          string      `json:"name"`
		Emoji         string      `json:"emoji"`
		Color         string      `json:"color"`
		Description   string      `json:"description"`
		Subcategories interface{} `json:"subcategories"`
		SortOrder     int         `json:"sort_order"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON inválido")
	}
	if body.Name == "" {
		return fiber.NewError(fiber.StatusBadRequest, "name é obrigatório")
	}
	if body.Emoji == "" {
		body.Emoji = "📂"
	}
	if body.Color == "" {
		body.Color = "#808080"
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	var id string
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO category_templates (name, emoji, color, description, subcategories, sort_order)
		 VALUES ($1, $2, $3, $4, $5::jsonb, $6) RETURNING id`,
		body.Name, body.Emoji, body.Color, body.Description,
		string(mustMarshalJSON(body.Subcategories)), body.SortOrder,
	).Scan(&id)
	if err != nil {
		log.Printf("[ERROR] handleAdminCreateCategoryTemplate: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id, "success": true})
}

func handleAdminUpdateCategoryTemplate(c *fiber.Ctx) error {
	id := c.Params("id")
	var body map[string]interface{}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON inválido")
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	_, err := db.Pool.Exec(ctx,
		`UPDATE category_templates SET
			name = COALESCE($1, name),
			emoji = COALESCE($2, emoji),
			color = COALESCE($3, color),
			description = COALESCE($4, description),
			subcategories = COALESCE($5::jsonb, subcategories),
			sort_order = COALESCE($6, sort_order),
			active = COALESCE($7, active)
		 WHERE id = $8`,
		body["name"], body["emoji"], body["color"], body["description"],
		nullableJSON(body["subcategories"]), body["sort_order"], body["active"], id,
	)
	if err != nil {
		log.Printf("[ERROR] handleAdminUpdateCategoryTemplate: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	return c.JSON(fiber.Map{"success": true})
}

func handleAdminDeleteCategoryTemplate(c *fiber.Ctx) error {
	return handleAdminDeleteOption("category_templates")(c)
}

// ─── Workspaces Admin ───

func handleAdminListWorkspaces(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	rows, err := db.Pool.Query(ctx,
		`SELECT w.id, w.name, w.plan_slug, w.suspended_at, w.created_at,
		        u.name AS owner_name, u.email AS owner_email,
		        (SELECT COUNT(*)::int FROM users WHERE workspace_id = w.id) AS member_count,
		        (SELECT COUNT(*)::int FROM transactions WHERE workspace_id = w.id) AS tx_count
		 FROM workspaces w
		 JOIN users u ON u.workspace_id = w.id AND u.role = 'proprietário'
		 ORDER BY w.created_at DESC`)
	if err != nil {
		log.Printf("[ERROR] handleAdminListWorkspaces: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	defer rows.Close()

	type WorkspaceRow struct {
		ID          string  `json:"id"`
		Name        string  `json:"name"`
		PlanSlug    *string `json:"plan_slug"`
		SuspendedAt *string `json:"suspended_at"`
		CreatedAt   string  `json:"created_at"`
		OwnerName   string  `json:"owner_name"`
		OwnerEmail  string  `json:"owner_email"`
		MemberCount int     `json:"member_count"`
		TxCount     int     `json:"tx_count"`
	}

	items := []WorkspaceRow{}
	for rows.Next() {
		var ws WorkspaceRow
		if err := rows.Scan(&ws.ID, &ws.Name, &ws.PlanSlug, &ws.SuspendedAt, &ws.CreatedAt,
			&ws.OwnerName, &ws.OwnerEmail, &ws.MemberCount, &ws.TxCount); err != nil {
			continue
		}
		items = append(items, ws)
	}
	return c.JSON(fiber.Map{"workspaces": items})
}

func handleAdminSuspendWorkspace(c *fiber.Ctx) error {
	id := c.Params("id")
	var body struct {
		Reason string `json:"reason"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON inválido")
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	_, err := db.Pool.Exec(ctx,
		"UPDATE workspaces SET suspended_at = CURRENT_TIMESTAMP, suspended_reason = $1 WHERE id = $2",
		body.Reason, id,
	)
	if err != nil {
		log.Printf("[ERROR] handleAdminSuspendWorkspace: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	return c.JSON(fiber.Map{"success": true})
}

func handleAdminReactivateWorkspace(c *fiber.Ctx) error {
	id := c.Params("id")
	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	_, err := db.Pool.Exec(ctx,
		"UPDATE workspaces SET suspended_at = NULL, suspended_reason = NULL WHERE id = $1", id,
	)
	if err != nil {
		log.Printf("[ERROR] handleAdminReactivateWorkspace: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	return c.JSON(fiber.Map{"success": true})
}

// ─── Audit Log ───

func handleAdminListAuditLog(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	rows, err := db.Pool.Query(ctx,
		`SELECT a.id, a.action, a.entity_type, a.entity_id, a.old_value, a.new_value,
		        a.created_at, u.name AS admin_name
		 FROM admin_audit_log a
		 JOIN users u ON u.id = a.admin_user_id
		 ORDER BY a.created_at DESC
		 LIMIT 100`)
	if err != nil {
		log.Printf("[ERROR] handleAdminListAuditLog: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
	}
	defer rows.Close()

	type LogEntry struct {
		ID         string      `json:"id"`
		Action     string      `json:"action"`
		EntityType string      `json:"entity_type"`
		EntityID   *string     `json:"entity_id"`
		OldValue   interface{} `json:"old_value"`
		NewValue   interface{} `json:"new_value"`
		CreatedAt  string      `json:"created_at"`
		AdminName  string      `json:"admin_name"`
	}

	items := []LogEntry{}
	for rows.Next() {
		var entry LogEntry
		if err := rows.Scan(&entry.ID, &entry.Action, &entry.EntityType, &entry.EntityID,
			&entry.OldValue, &entry.NewValue, &entry.CreatedAt, &entry.AdminName); err != nil {
			continue
		}
		items = append(items, entry)
	}
	return c.JSON(fiber.Map{"entries": items})
}

// ─── Public Options (não-admin, para consumo do PWA) ───

func handlePublicOptions(table, orderCol string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !allowedOptionTables[table] {
			return fiber.NewError(fiber.StatusBadRequest, "tabela não permitida")
		}
		ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
		defer cancel()
		rows, err := db.Pool.Query(ctx,
			"SELECT row_to_json(t) FROM "+table+" t WHERE active = true ORDER BY "+orderCol)
		if err != nil {
			log.Printf("[ERROR] handlePublicOptions(%s): %v", table, err)
			return fiber.NewError(fiber.StatusInternalServerError, "erro interno do servidor")
		}
		defer rows.Close()

		items := []interface{}{}
		for rows.Next() {
			var item interface{}
			if err := rows.Scan(&item); err != nil {
				continue
			}
			items = append(items, item)
		}
		return c.JSON(fiber.Map{"items": items})
	}
}
