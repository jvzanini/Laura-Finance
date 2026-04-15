package cache

import (
	"context"
	"fmt"
)

// InvalidateWorkspace limpa todas as keys de um workspace.
// Se scopes vazio: limpa "ws:{id}:*" (tudo).
// Senão: limpa "ws:{id}:{scope}:*" para cada scope.
func InvalidateWorkspace(ctx context.Context, c Cache, workspaceID string, scopes []string) error {
	if c == nil {
		return nil
	}
	if len(scopes) == 0 {
		return c.Invalidate(ctx, fmt.Sprintf("ws:%s:*", workspaceID))
	}
	for _, scope := range scopes {
		pattern := fmt.Sprintf("ws:%s:%s:*", workspaceID, scope)
		if err := c.Invalidate(ctx, pattern); err != nil {
			return err
		}
	}
	return nil
}
