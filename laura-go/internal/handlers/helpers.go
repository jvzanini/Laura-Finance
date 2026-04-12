package handlers

import (
	"encoding/json"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// timeNowMonth retorna o mês corrente como "YYYY-MM" — helper
// compartilhado pelos handlers que precisam responder com o
// formato de mês quando nenhum filtro é aplicado.
func timeNowMonth() string {
	now := time.Now()
	return now.Format("2006-01")
}

func hashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

func checkPasswordHash(password, hash string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func mustMarshalJSON(v interface{}) []byte {
	b, _ := json.Marshal(v)
	return b
}
