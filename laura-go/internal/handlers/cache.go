package handlers

import "github.com/jvzanini/laura-finance/laura-go/internal/cache"

// Cache é a instância compartilhada do cache (Redis ou InMemory), injetada
// em main.go via bootstrap.InitCache(). Pode ser nil (GetOrCompute lida).
var Cache cache.Cache
