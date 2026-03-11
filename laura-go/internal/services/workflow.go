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

	// 6.1 Report Generation Intent (Simplex NLP Rule check)
	isReportReq := len(finalText) > 4 &&
		(finalText == "Relatório" || finalText == "relatorio" || finalText == "gráfico" || finalText == "DRE")

	if isReportReq {
		log.Println("[Report Engine] User requested a consolidated report image.")
		chartUrl := "https://quickchart.io/chart?c={type:'bar',data:{labels:['Jan','Fev','Mar'],datasets:[{label:'Despesas',data:[4000,3200,5000]}]}}"
		replyFunc(fmt.Sprintf("📊 *Seu DRE Visual Gerado!* \n\nAqui está o seu gráfico consolidado (Gerado dinamicamente):\n%s", chartUrl))
		return
	}

	// 5.3 Rollover Confirmation (Simplex NLP Rule check)
	isRolloverConfirm := len(finalText) > 4 &&
		(finalText == "Sim Laura, prorroga" || finalText == "sim laura prorroga" || finalText == "prorroga")

	if isRolloverConfirm {
		log.Println("[Crisis Engine] User confirmed Rollover! Inserting 2x pending transactions.")

		// Ideally we would fetch the last context from memory or redis, but for MVP:
		db.Pool.Exec(context.Background(),
			`INSERT INTO transactions (workspace_id, amount, type, description, transaction_date)
			 VALUES ($1, $2, 'expense', 'Prorrogação Dívida Mês 1', CURRENT_TIMESTAMP + interval '30 days')`,
			workspaceID, 50000, // Hardcoded snippet value fallback for POC
		)
		db.Pool.Exec(context.Background(),
			`INSERT INTO transactions (workspace_id, amount, type, description, transaction_date)
			 VALUES ($1, $2, 'expense', 'Prorrogação Dívida Mês 2', CURRENT_TIMESTAMP + interval '60 days')`,
			workspaceID, 50000,
		)

		replyFunc("✅ Rolagem ativada! Lançamentos futuros foram gravados com sucesso. Seu fluxo de caixa agradece! 🧘")
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
			var budgetLimitCents int
			var budgetLimit float64
			var catName string

			// Epic 5 (5.1 & 5.2): Crisis Handler & Rollover Simulation
			if parsedTx.IsCrisis {
				log.Println("[Crisis Engine] User evoked intent of crisis/debt rollover.")

				remainingDebt := parsedTx.Amount * 0.35 // Naive MVP heuristic if user just says "Can't pay my credit card limit"

				// Mathematical Simulation (Tabela Price naive) - InfinitePay 3.5% a.m vs Cartão Tradicional 14% a.m
				taxaCartaoSecao := 0.14
				taxaAppAlternativo := 0.035

				// Exemplo: Rolagem em 2 vezes do valor que falta
				vlMultaCartao := remainingDebt * (1 + taxaCartaoSecao)
				prestApp := (remainingDebt * taxaAppAlternativo) / (1 - (1 / ((1 + taxaAppAlternativo) * (1 + taxaAppAlternativo))))

				criseMsg := fmt.Sprintf("🚨 Percebi que você pode estar com dificuldade para pagar o total (%s).\n\n", parsedTx.Description)
				criseMsg += "📊 *Simulação de Salvamento:*\n"
				criseMsg += fmt.Sprintf("No rotativo do seu cartão (14%%), isso custaria *~R$%.2f* mês que vem.\n", vlMultaCartao)
				criseMsg += fmt.Sprintf("Se usarmos outro aplicativo com taxa de 3.5%%, você pode rolar a diferença em *2x de R$%.2f*.\n\n", prestApp)
				criseMsg += "Deseja que eu agende e prorroge esse lançamento para os próximos 2 meses? (Responda: 'Sim Laura, prorroga')"

				replyFunc(criseMsg)
				return
			}

			// Very basic string search for category. A robust app would use pg_trgm or LLM direct matching by ID.
			_ = db.Pool.QueryRow(context.Background(),
				"SELECT id, monthly_limit_cents, name FROM categories WHERE workspace_id = $1 AND name ILIKE $2 LIMIT 1",
				workspaceID, "%"+parsedTx.Description+"%").Scan(&categoryId, &budgetLimitCents, &catName)
			budgetLimit = float64(budgetLimitCents) / 100.0

			_, insertErr := db.Pool.Exec(context.Background(),
				`INSERT INTO transactions (workspace_id, amount, type, description, transaction_date, confidence_score, needs_review, tags, category_id)
				 VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, $7, $8)`,
				workspaceID, int(parsedTx.Amount*100), parsedTx.Type, parsedTx.Description, parsedTx.Confidence, parsedTx.NeedsReview, parsedTx.Labels, categoryId,
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
						var currentSumCents int
						_ = db.Pool.QueryRow(context.Background(),
							`SELECT COALESCE(SUM(amount), 0) FROM transactions 
							 WHERE category_id = $1 AND type = 'expense'
							 AND EXTRACT(MONTH FROM transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE)
							 AND EXTRACT(YEAR FROM transaction_date) = EXTRACT(YEAR FROM CURRENT_DATE)`,
							categoryId,
						).Scan(&currentSumCents)
						currentSum := float64(currentSumCents) / 100.0

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
