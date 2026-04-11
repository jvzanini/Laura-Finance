package services

import (
	"encoding/json"
	"testing"
)

func TestSimulateRollover_InfinitePay2x(t *testing.T) {
	sim, err := SimulateRollover("ws-test", nil, 100_000, "infinitepay", "2x")
	if err != nil {
		t.Fatalf("SimulateRollover erro inesperado: %v", err)
	}
	if sim.Institution != "InfinitePay" {
		t.Errorf("Institution = %s, esperado InfinitePay", sim.Institution)
	}
	if sim.TotalOperations != 2 {
		t.Errorf("TotalOperations = %d, esperado 2", sim.TotalOperations)
	}
	if sim.FeePercentage != 4.50 {
		t.Errorf("FeePercentage = %.2f, esperado 4.50", sim.FeePercentage)
	}
	if len(sim.Operations) != 2 {
		t.Errorf("len(Operations) = %d, esperado 2", len(sim.Operations))
	}
	// Cada parcela = 50_000 cents (R$ 500). Taxa 4.5% = 2_250 cents (R$ 22,50).
	if sim.Operations[0].AmountCts != 50_000 {
		t.Errorf("Operations[0].AmountCts = %d, esperado 50000", sim.Operations[0].AmountCts)
	}
	if sim.Operations[0].FeeCts != 2_250 {
		t.Errorf("Operations[0].FeeCts = %d, esperado 2250", sim.Operations[0].FeeCts)
	}
	// Total de taxas = 2 * 2250 = 4500
	if sim.TotalFeesCts != 4_500 {
		t.Errorf("TotalFeesCts = %d, esperado 4500", sim.TotalFeesCts)
	}
}

func TestSimulateRollover_StoneX12(t *testing.T) {
	sim, err := SimulateRollover("ws-test", nil, 1_200_00, "stone", "12x")
	if err != nil {
		t.Fatalf("SimulateRollover erro inesperado: %v", err)
	}
	if sim.TotalOperations != 12 {
		t.Errorf("TotalOperations = %d, esperado 12", sim.TotalOperations)
	}
	// Stone 12x = 17.59%
	if sim.FeePercentage != 17.59 {
		t.Errorf("FeePercentage = %.2f, esperado 17.59", sim.FeePercentage)
	}
	// Soma dos AmountCts deve bater com invoice (tolerância de 1 cent por round)
	sum := 0
	for _, op := range sim.Operations {
		sum += op.AmountCts
	}
	diff := sum - 120_000
	if diff < -12 || diff > 12 {
		t.Errorf("soma das parcelas divergiu demais: sum=%d invoice=120000", sum)
	}
}

func TestSimulateRollover_ProcessorDesconhecido(t *testing.T) {
	_, err := SimulateRollover("ws", nil, 50_000, "banco_imaginario", "2x")
	if err == nil {
		t.Fatal("esperava erro para processor desconhecido, veio nil")
	}
}

func TestSimulateRollover_InstallmentInvalido(t *testing.T) {
	_, err := SimulateRollover("ws", nil, 50_000, "infinitepay", "15x")
	if err == nil {
		t.Fatal("esperava erro para installments não suportado, veio nil")
	}
}

func TestSimulateRollover_OperationsJSONSerializavel(t *testing.T) {
	// Garante que o struct de operações serializa limpo pra JSONB.
	sim, err := SimulateRollover("ws", nil, 80_000, "ton", "4x")
	if err != nil {
		t.Fatalf("simulate: %v", err)
	}
	blob, err := json.Marshal(sim.Operations)
	if err != nil {
		t.Fatalf("json.Marshal: %v", err)
	}
	if len(blob) == 0 {
		t.Fatal("json serializado vazio")
	}
	// Desserializa de volta e confere a contagem
	var back []RolloverOperation
	if err := json.Unmarshal(blob, &back); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if len(back) != sim.TotalOperations {
		t.Errorf("roundtrip JSON: len = %d, esperado %d", len(back), sim.TotalOperations)
	}
}

func TestFeeTable_CobreTodosProcessadoresDoPWA(t *testing.T) {
	// Garante paridade com a tabela TypeScript em invoices/push/page.tsx.
	// Se alguém adicionar um processador lá, esse teste força refletir aqui.
	expected := []string{"infinitepay", "ton", "stone", "mercadopago", "cielo", "pagbank"}
	for _, slug := range expected {
		if _, ok := FeeTable[slug]; !ok {
			t.Errorf("FeeTable não contém %q — PWA e Go divergiram", slug)
		}
	}
	for slug, p := range FeeTable {
		for i := 1; i <= 12; i++ {
			key := "1x"
			switch i {
			case 1:
				key = "1x"
			case 2:
				key = "2x"
			case 3:
				key = "3x"
			case 4:
				key = "4x"
			case 5:
				key = "5x"
			case 6:
				key = "6x"
			case 7:
				key = "7x"
			case 8:
				key = "8x"
			case 9:
				key = "9x"
			case 10:
				key = "10x"
			case 11:
				key = "11x"
			case 12:
				key = "12x"
			}
			if _, ok := p.Fees[key]; !ok {
				t.Errorf("FeeTable[%q] não contém parcelamento %q", slug, key)
			}
		}
	}
}
