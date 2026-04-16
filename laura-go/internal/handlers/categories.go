package handlers

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/cache"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
	"github.com/jvzanini/laura-finance/laura-go/internal/obs"
)

type SubcategoryItem struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Emoji       *string `json:"emoji"`
	Description *string `json:"description"`
}

type CategoryItem struct {
	ID                string            `json:"id"`
	Name              string            `json:"name"`
	Emoji             *string           `json:"emoji"`
	Color             string            `json:"color"`
	Description       *string           `json:"description"`
	MonthlyLimitCents int               `json:"monthly_limit_cents"`
	Subcategories     []SubcategoryItem `json:"subcategories"`
}

type CategoriesResponse struct {
	Categories []CategoryItem `json:"categories"`
}

// handleListCategories retorna todas as categorias do workspace
// com suas subcategorias aninhadas (árvore), em 2 queries.
func handleListCategories(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return obs.RespondError(c, obs.CodeAuthInvalidCredentials, fiber.StatusUnauthorized, errors.New("sem sessão"))
	}

	key := fmt.Sprintf("ws:%s:categories:list", sess.WorkspaceID)
	resp, err := cache.GetOrCompute[CategoriesResponse](c.Context(), Cache, key, 1800*time.Second, func(parentCtx context.Context) (CategoriesResponse, error) {
		return computeCategoriesList(parentCtx, sess.WorkspaceID)
	})
	if err != nil {
		slog.Error("handleListCategories", "err", err)
		return obs.RespondError(c, obs.CodeInternal, fiber.StatusInternalServerError, errors.New("erro interno do servidor"))
	}
	return c.JSON(resp)
}

func computeCategoriesList(parentCtx context.Context, workspaceID string) (CategoriesResponse, error) {
	ctx, cancel := context.WithTimeout(parentCtx, 10*time.Second)
	defer cancel()

	catRows, err := db.Pool.Query(ctx,
		`SELECT id, name, emoji, COALESCE(color, '#808080'), description, COALESCE(monthly_limit_cents, 0)
		 FROM categories
		 WHERE workspace_id = $1
		 ORDER BY name ASC`,
		workspaceID,
	)
	if err != nil {
		return CategoriesResponse{}, err
	}
	defer catRows.Close()

	categories := []CategoryItem{}
	catIndex := map[string]*CategoryItem{}
	for catRows.Next() {
		var c CategoryItem
		if err := catRows.Scan(&c.ID, &c.Name, &c.Emoji, &c.Color, &c.Description, &c.MonthlyLimitCents); err != nil {
			continue
		}
		c.Subcategories = []SubcategoryItem{}
		categories = append(categories, c)
	}
	// Build index apontando para os elementos na slice atualizada
	for i := range categories {
		catIndex[categories[i].ID] = &categories[i]
	}

	subRows, err := db.Pool.Query(ctx,
		`SELECT id, category_id, name, emoji, description
		 FROM subcategories
		 WHERE workspace_id = $1
		 ORDER BY name ASC`,
		workspaceID,
	)
	if err != nil {
		return CategoriesResponse{}, err
	}
	defer subRows.Close()

	for subRows.Next() {
		var categoryID string
		var s SubcategoryItem
		if err := subRows.Scan(&s.ID, &categoryID, &s.Name, &s.Emoji, &s.Description); err != nil {
			continue
		}
		if cat, ok := catIndex[categoryID]; ok {
			cat.Subcategories = append(cat.Subcategories, s)
		}
	}

	return CategoriesResponse{Categories: categories}, nil
}

type CreateCategoryRequest struct {
	Name              string `json:"name"`
	Emoji             string `json:"emoji"`
	Color             string `json:"color"`
	Description       string `json:"description"`
	MonthlyLimitCents int    `json:"monthly_limit_cents"`
}

type CreateCategoryResponse struct {
	ID      string `json:"id"`
	Success bool   `json:"success"`
}

func handleCreateCategory(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return obs.RespondError(c, obs.CodeAuthInvalidCredentials, fiber.StatusUnauthorized, errors.New("sem sessão"))
	}

	var req CreateCategoryRequest
	if err := c.BodyParser(&req); err != nil {
		return obs.RespondError(c, obs.CodeValidationFailed, fiber.StatusBadRequest, err)
	}
	if req.Name == "" {
		return obs.RespondError(c, obs.CodeValidationFailed, fiber.StatusBadRequest, errors.New("nome é obrigatório"))
	}
	if req.Emoji == "" {
		req.Emoji = "📂"
	}
	if req.Color == "" {
		req.Color = "#808080"
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	var catID string
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO categories (workspace_id, name, monthly_limit_cents, color, emoji, description)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id`,
		sess.WorkspaceID, req.Name, req.MonthlyLimitCents, req.Color, req.Emoji, req.Description,
	).Scan(&catID)
	if err != nil {
		slog.Error("handleCreateCategory", "err", err)
		return obs.RespondError(c, obs.CodeInternal, fiber.StatusInternalServerError, errors.New("erro interno do servidor"))
	}
	if err := cache.InvalidateWorkspace(c.Context(), Cache, sess.WorkspaceID, []string{"categories"}); err != nil {
		slog.WarnContext(c.Context(), "cache_invalidate_failed", "err", err)
	}
	return c.Status(fiber.StatusCreated).JSON(CreateCategoryResponse{ID: catID, Success: true})
}

type SeedCategoryInput struct {
	Name              string                `json:"name"`
	Emoji             string                `json:"emoji"`
	Color             string                `json:"color"`
	Description       string                `json:"description"`
	MonthlyLimitCents int                   `json:"monthly_limit_cents"`
	Subcategories     []SeedSubcategoryInput `json:"subcategories"`
}

type SeedSubcategoryInput struct {
	Name        string `json:"name"`
	Emoji       string `json:"emoji"`
	Description string `json:"description"`
}

type SeedCategoriesRequest struct {
	Categories []SeedCategoryInput `json:"categories"`
}

func handleSeedCategories(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return obs.RespondError(c, obs.CodeAuthInvalidCredentials, fiber.StatusUnauthorized, errors.New("sem sessão"))
	}

	var req SeedCategoriesRequest
	if err := c.BodyParser(&req); err != nil {
		return obs.RespondError(c, obs.CodeValidationFailed, fiber.StatusBadRequest, err)
	}
	if len(req.Categories) == 0 {
		return obs.RespondError(c, obs.CodeValidationFailed, fiber.StatusBadRequest, errors.New("lista de categorias vazia"))
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		slog.Error("handleSeedCategories (begin)", "err", err)
		return obs.RespondError(c, obs.CodeInternal, fiber.StatusInternalServerError, errors.New("erro interno do servidor"))
	}
	defer func() { _ = tx.Rollback(ctx) }()

	for _, cat := range req.Categories {
		var catID string
		err := tx.QueryRow(ctx,
			`INSERT INTO categories (workspace_id, name, monthly_limit_cents, color, emoji, description)
			 VALUES ($1, $2, $3, $4, $5, $6)
			 RETURNING id`,
			sess.WorkspaceID, cat.Name, cat.MonthlyLimitCents, cat.Color, cat.Emoji, cat.Description,
		).Scan(&catID)
		if err != nil {
			slog.Error("handleSeedCategories (insert cat)", "err", err)
			return obs.RespondError(c, obs.CodeInternal, fiber.StatusInternalServerError, errors.New("erro interno do servidor"))
		}

		for _, sub := range cat.Subcategories {
			_, err := tx.Exec(ctx,
				`INSERT INTO subcategories (workspace_id, category_id, name, emoji, description)
				 VALUES ($1, $2, $3, $4, $5)`,
				sess.WorkspaceID, catID, sub.Name, sub.Emoji, sub.Description,
			)
			if err != nil {
				slog.Error("handleSeedCategories (insert sub)", "err", err)
				return obs.RespondError(c, obs.CodeInternal, fiber.StatusInternalServerError, errors.New("erro interno do servidor"))
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		slog.Error("handleSeedCategories (commit)", "err", err)
		return obs.RespondError(c, obs.CodeInternal, fiber.StatusInternalServerError, errors.New("erro interno do servidor"))
	}
	if err := cache.InvalidateWorkspace(c.Context(), Cache, sess.WorkspaceID, []string{"categories"}); err != nil {
		slog.WarnContext(c.Context(), "cache_invalidate_failed", "err", err)
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true})
}
