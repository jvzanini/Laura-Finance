package migrations

import "testing"

func TestEmbed_HasAllMigrations(t *testing.T) {
	entries, err := FS.ReadDir(".")
	if err != nil {
		t.Fatalf("ReadDir: %v", err)
	}
	count := 0
	for _, e := range entries {
		if !e.IsDir() {
			count++
		}
	}
	if count < 35 {
		t.Fatalf("esperava >=35 migrations embutidas, veio %d", count)
	}
}
