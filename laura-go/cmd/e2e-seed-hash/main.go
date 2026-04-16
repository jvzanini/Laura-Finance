// Helper CLI para gerar bcrypt hashes das senhas de seed E2E.
// Uso: go run ./cmd/e2e-seed-hash/
// Output: linhas "senha -> $2a$10$..." para colar em scripts/e2e-seed.sql.
package main

import (
	"fmt"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	passwords := []string{"e2epass123!", "admin123!"}
	for _, pw := range passwords {
		h, err := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
		if err != nil {
			panic(err)
		}
		fmt.Printf("%s -> %s\n", pw, string(h))
	}
}
