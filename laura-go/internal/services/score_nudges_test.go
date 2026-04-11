package services

import "testing"

func TestClassifyScore(t *testing.T) {
	cases := []struct {
		score int
		want  scoreBand
	}{
		{0, bandCritico},
		{39, bandCritico},
		{40, bandRegular},
		{59, bandRegular},
		{60, bandBom},
		{79, bandBom},
		{80, bandExcelente},
		{100, bandExcelente},
	}
	for _, c := range cases {
		got := classifyScore(c.score)
		if got != c.want {
			t.Errorf("classifyScore(%d) = %v, esperado %v", c.score, got, c.want)
		}
	}
}

func TestScoreBand_Ordering(t *testing.T) {
	// bandCritico < bandRegular < bandBom < bandExcelente
	// A comparação `todayBand >= yesterdayBand` no cron usa essa ordenação
	// para decidir se deve enviar nudge (quando today < yesterday).
	if bandCritico >= bandRegular {
		t.Error("bandCritico deveria ser menor que bandRegular")
	}
	if bandRegular >= bandBom {
		t.Error("bandRegular deveria ser menor que bandBom")
	}
	if bandBom >= bandExcelente {
		t.Error("bandBom deveria ser menor que bandExcelente")
	}
}

func TestScoreBand_Labels(t *testing.T) {
	if bandExcelente.label() != "Excelente" {
		t.Errorf("bandExcelente.label() = %s", bandExcelente.label())
	}
	if bandBom.label() != "Bom" {
		t.Errorf("bandBom.label() = %s", bandBom.label())
	}
	if bandRegular.label() != "Regular" {
		t.Errorf("bandRegular.label() = %s", bandRegular.label())
	}
	if bandCritico.label() != "Crítico" {
		t.Errorf("bandCritico.label() = %s", bandCritico.label())
	}
}
