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
