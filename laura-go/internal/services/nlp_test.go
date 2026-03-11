package services

import (
	"encoding/json"
	"testing"
)

func TestExtractTransactionFromTextParser(t *testing.T) {
	// Mock JSON output from LLM
	rawJson := `{
  "amount": 25.50,
  "description": "Ifood",
  "type": "expense",
  "labels": ["lanche"],
  "confidence": 0.95,
  "needs_review": false,
  "is_crisis": false
}`

	var parsed ParsedTransactionDef
	err := json.Unmarshal([]byte(rawJson), &parsed)
	if err != nil {
		t.Fatalf("Failed to parse JSON: %v", err)
	}

	if parsed.Amount != 25.50 {
		t.Errorf("Expected Amount 25.50, got %v", parsed.Amount)
	}
	if parsed.Description != "Ifood" {
		t.Errorf("Expected Description 'Ifood', got %s", parsed.Description)
	}
	if parsed.Type != "expense" {
		t.Errorf("Expected Type 'expense', got %s", parsed.Type)
	}
	if len(parsed.Labels) != 1 || parsed.Labels[0] != "lanche" {
		t.Errorf("Expected Labels ['lanche'], got %v", parsed.Labels)
	}
	if parsed.Confidence != 0.95 {
		t.Errorf("Expected Confidence 0.95, got %v", parsed.Confidence)
	}
	if parsed.NeedsReview != false {
		t.Errorf("Expected NeedsReview false, got %v", parsed.NeedsReview)
	}
	if parsed.IsCrisis != false {
		t.Errorf("Expected IsCrisis false, got %v", parsed.IsCrisis)
	}
}

func TestCrisisTransactionParser(t *testing.T) {
	rawJson := `{
  "amount": 6000,
  "description": "Fatura Itaú",
  "type": "expense",
  "labels": ["fatura"],
  "confidence": 0.98,
  "needs_review": false,
  "is_crisis": true,
  "crisis_reason": "Só tem 2000 para pagar a fatura de 6000"
}`

	var parsed ParsedTransactionDef
	err := json.Unmarshal([]byte(rawJson), &parsed)
	if err != nil {
		t.Fatalf("Failed to parse JSON: %v", err)
	}

	if !parsed.IsCrisis {
		t.Errorf("Expected IsCrisis true, got %v", parsed.IsCrisis)
	}
	if parsed.CrisisReason != "Só tem 2000 para pagar a fatura de 6000" {
		t.Errorf("Expected CrisisReason 'Só tem 2000 para pagar a fatura de 6000', got '%v'", parsed.CrisisReason)
	}
}
