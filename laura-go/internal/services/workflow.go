package services

import (
	"context"
	"fmt"
	"log"

	"github.com/jvzanini/laura-finance/laura-go/internal/db"
)

// ProcessMessageFlow processes raw text or audio coming from Whatsmeow into structured Transaction
func ProcessMessageFlow(workspaceID string, phoneNumber string, text string, audioBytes []byte, replyFunc func(string)) {
	finalText := text

	// Se for audio, convertemos Whisper
	if len(audioBytes) > 0 {
		fmt.Printf("[Background Goroutine] Detected Audio Voice. Converting via Groq Whisper...\n")
		transcribed, err := TranscribeAudio(audioBytes, "voice.ogg")
		if err != nil {
			log.Printf("[Error] Transcribing audio: %v\n", err)
			finalText = "[Audio Incompreensível ou Falha]"
		} else {
			finalText = transcribed
			log.Printf("[Success] Transcribed Audio: %s\n", finalText)
		}
	}

	if finalText == "" || finalText == "[Audio Incompreensível ou Falha]" {
		return
	}

	fmt.Printf("[ProcessMessageFlow Started] Passing to Brain/LLM... [%s]\n", finalText)

	// Extraction with LLM
	rawJsonStr, parsedTx, err := ExtractTransactionFromText(finalText)

	if db.Pool != nil {
		logStatus := "processed"
		if err != nil {
			logStatus = "error"
			log.Printf("[NLP Parsing Error]: %v\n", err)
		} else if parsedTx != nil && parsedTx.NeedsReview {
			logStatus = "needs_review"
		}

		db.Pool.Exec(context.Background(),
			`INSERT INTO message_logs (workspace_id, phone_number, raw_message, processed_json, status)
			 VALUES ($1, $2, $3, $4, $5)`,
			workspaceID, phoneNumber, finalText, rawJsonStr, logStatus,
		)

		if err == nil && parsedTx != nil {
			// Let's grab the actual category if we can match it roughly, but for now we insert NULL if not matched
			// However, to make Nudges work we should try to match the category by name (simulated here for MVP)
			var categoryId *string
			var budgetLimit float64
			var catName string

			// Very basic string search for category. A robust app would use pg_trgm or LLM direct matching by ID.
			_ = db.Pool.QueryRow(context.Background(),
				"SELECT id, budget_limit, name FROM categories WHERE workspace_id = $1 AND name ILIKE $2 LIMIT 1",
				workspaceID, "%"+parsedTx.Description+"%").Scan(&categoryId, &budgetLimit, &catName)

			_, insertErr := db.Pool.Exec(context.Background(),
				`INSERT INTO transactions (workspace_id, amount, type, description, transaction_date, confidence_score, needs_review, tags, category_id)
				 VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, $7, $8)`,
				workspaceID, parsedTx.Amount, parsedTx.Type, parsedTx.Description, parsedTx.Confidence, parsedTx.NeedsReview, parsedTx.Labels, categoryId,
			)

			if insertErr != nil {
				log.Printf("[Transaction Insertion Error]: %v\n", insertErr)
				replyFunc(fmt.Sprintf("❌ Ops, tive um problema ao salvar seu gasto: %s", parsedTx.Description))
			} else {
				log.Printf("✅ Transaction saved successfully: %s - $%.2f\n", parsedTx.Description, parsedTx.Amount)

				if parsedTx.NeedsReview || parsedTx.Confidence < 0.60 {
					// 4.1 Desambiguação Ativa NLP
					replyFunc(fmt.Sprintf("🤔 Fiquei na dúvida sobre: '%s' no valor de R$%.2f.\nEle foi registrado com status de Revisão.\nVocê pode corrigir isso direto no Dashboard!", parsedTx.Description, parsedTx.Amount))
				} else {
					// 4.2 Nudges Preditivos e Check Base
					baseReply := fmt.Sprintf("✅ Anotado: %s de R$%.2f", parsedTx.Description, parsedTx.Amount)

					if categoryId != nil && budgetLimit > 0 {
						// Calculate current month sum
						var currentSum float64
						_ = db.Pool.QueryRow(context.Background(),
							`SELECT COALESCE(SUM(amount), 0) FROM transactions 
							 WHERE category_id = $1 AND type = 'expense'
							 AND EXTRACT(MONTH FROM transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE)
							 AND EXTRACT(YEAR FROM transaction_date) = EXTRACT(YEAR FROM CURRENT_DATE)`,
							categoryId,
						).Scan(&currentSum)

						percentage := (currentSum / budgetLimit) * 100
						if percentage > 100 {
							baseReply += fmt.Sprintf("\n🚨 Alerta Vermelho! Você estourou seu teto de %s. Gastou R$%.2f de R$%.2f", catName, currentSum, budgetLimit)
						} else if percentage >= 80 {
							baseReply += fmt.Sprintf("\n⚠️ Cuidado! Você já gastou %.0f%% do seu orçamento de %s (R$%.2f/R$%.2f).", percentage, catName, currentSum, budgetLimit)
						} else {
							baseReply += fmt.Sprintf("\n📊 Tudo sob controle na categoria %s.", catName)
						}
					}

					replyFunc(baseReply)
				}
			}
		} else {
			replyFunc("Desculpe, não consegui entender nenhum valor financeiro na sua mensagem.")
		}
	}
}
