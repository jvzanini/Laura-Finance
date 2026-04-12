package handlers

import (
	"context"

	"github.com/gofiber/fiber/v2"
	"github.com/jvzanini/laura-finance/laura-go/internal/db"
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
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	ctx := context.Background()

	catRows, err := db.Pool.Query(ctx,
		`SELECT id, name, emoji, COALESCE(color, '#808080'), description, COALESCE(monthly_limit_cents, 0)
		 FROM categories
		 WHERE workspace_id = $1
		 ORDER BY name ASC`,
		sess.WorkspaceID,
	)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
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
		sess.WorkspaceID,
	)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
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

	return c.JSON(CategoriesResponse{Categories: categories})
}

type CreateCategoryRequest struct {
	Name             string `json:"name"`
	Emoji            string `json:"emoji"`
	Color            string `json:"color"`
	Description      string `json:"description"`
	MonthlyLimitCents int   `json:"monthly_limit_cents"`
}

type CreateCategoryResponse struct {
	ID      string `json:"id"`
	Success bool   `json:"success"`
}

func handleCreateCategory(c *fiber.Ctx) error {
	sess := getSession(c)
	if sess == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	var req CreateCategoryRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON inválido")
	}
	if req.Name == "" {
		return fiber.NewError(fiber.StatusBadRequest, "nome é obrigatório")
	}
	if req.Emoji == "" {
		req.Emoji = "📂"
	}
	if req.Color == "" {
		req.Color = "#808080"
	}

	ctx := context.Background()
	var catID string
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO categories (workspace_id, name, monthly_limit_cents, color, emoji, description)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id`,
		sess.WorkspaceID, req.Name, req.MonthlyLimitCents, req.Color, req.Emoji, req.Description,
	).Scan(&catID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.Status(fiber.StatusCreated).JSON(CreateCategoryResponse{ID: catID, Success: true})
}

type SeedCategoryInput struct {
	Name             string               `json:"name"`
	Emoji            string               `json:"emoji"`
	Color            string               `json:"color"`
	Description      string               `json:"description"`
	MonthlyLimitCents int                  `json:"monthly_limit_cents"`
	Subcategories    []SeedSubcategoryInput `json:"subcategories"`
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
		return fiber.NewError(fiber.StatusUnauthorized, "sem sessão")
	}

	var req SeedCategoriesRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "JSON inválido")
	}
	if len(req.Categories) == 0 {
		return fiber.NewError(fiber.StatusBadRequest, "lista de categorias vazia")
	}

	ctx := context.Background()
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	defer tx.Rollback(ctx)

	for _, cat := range req.Categories {
		var catID string
		err := tx.QueryRow(ctx,
			`INSERT INTO categories (workspace_id, name, monthly_limit_cents, color, emoji, description)
			 VALUES ($1, $2, $3, $4, $5, $6)
			 RETURNING id`,
			sess.WorkspaceID, cat.Name, cat.MonthlyLimitCents, cat.Color, cat.Emoji, cat.Description,
		).Scan(&catID)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}

		for _, sub := range cat.Subcategories {
			_, err := tx.Exec(ctx,
				`INSERT INTO subcategories (workspace_id, category_id, name, emoji, description)
				 VALUES ($1, $2, $3, $4, $5)`,
				sess.WorkspaceID, catID, sub.Name, sub.Emoji, sub.Description,
			)
			if err != nil {
				return fiber.NewError(fiber.StatusInternalServerError, err.Error())
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true})
}
