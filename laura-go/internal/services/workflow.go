package services

import (
	"context"
	"fmt"
	"log"

	"github.com/jvzanini/laura-finance/laura-go/internal/db"
)

// ProcessMessageFlow processes raw text or audio coming from Whatsmeow into structured Transaction
func ProcessMessageFlow(workspaceID string, phoneNumber string, text string, audioBytes []byte) {
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
			_, insertErr := db.Pool.Exec(context.Background(),
				`INSERT INTO transactions (workspace_id, amount, type, description, transaction_date, confidence_score, needs_review, tags)
				 VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, $7)`,
				workspaceID, parsedTx.Amount, parsedTx.Type, parsedTx.Description, parsedTx.Confidence, parsedTx.NeedsReview, parsedTx.Labels,
			)
			if insertErr != nil {
				log.Printf("[Transaction Insertion Error]: %v\n", insertErr)
			} else {
				log.Printf("✅ Transaction saved successfully: %s - $%.2f\n", parsedTx.Description, parsedTx.Amount)
			}
		}
	}
}
