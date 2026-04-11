package handlers

import "time"

// timeNowMonth retorna o mês corrente como "YYYY-MM" — helper
// compartilhado pelos handlers que precisam responder com o
// formato de mês quando nenhum filtro é aplicado.
func timeNowMonth() string {
	now := time.Now()
	return now.Format("2006-01")
}
