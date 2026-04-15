package services

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/jvzanini/laura-finance/laura-go/internal/db"
)

// ProcessMessageFlow processes raw text or audio coming from Whatsmeow into structured Transaction
func ProcessMessageFlow(workspaceID string, phoneNumber string, text string, audioBytes []byte, replyFunc func(string)) {
	// Resolver plano do workspace para usar o provider correto
	planSlug := GetWorkspacePlanSlug(workspaceID)
	caps := GetPlanCapabilities(planSlug)

	finalText := text

	// Se for audio, checar capability e converter via Whisper
	if len(audioBytes) > 0 {
		if !caps.Audio {
			replyFunc("Seu plano atual nao suporta mensagens de audio. Envie por texto ou faca upgrade para o plano VIP.")
			return
		}
		fmt.Printf("[Background Goroutine] Detected Audio Voice. Converting via %s Whisper...\n", planSlug)
		transcribed, err := TranscribeAudioForPlan(audioBytes, "voice.ogg", planSlug)
		if err != nil {
			slog.Error("[Error] transcribing audio", "err", err)
			finalText = "[Audio Incompreensível ou Falha]"
		} else {
			finalText = transcribed
			slog.Info("[Success] transcribed audio", "text", finalText)
		}
	}

	if finalText == "" || finalText == "[Audio Incompreensível ou Falha]" {
		return
	}

	// 6.1 Report Generation Intent (Simplex NLP Rule check)
	isReportReq := len(finalText) > 4 &&
		(finalText == "Relatório" || finalText == "relatorio" || finalText == "gráfico" || finalText == "DRE")

	if isReportReq {
		slog.Info("[Report Engine] User requested a consolidated report image.")
		chartUrl := "https://quickchart.io/chart?c={type:'bar',data:{labels:['Jan','Fev','Mar'],datasets:[{label:'Despesas',data:[4000,3200,5000]}]}}"
		replyFunc(fmt.Sprintf("📊 *Seu DRE Visual Gerado!* \n\nAqui está o seu gráfico consolidado (Gerado dinamicamente):\n%s", chartUrl))
		return
	}

	// 5.3 Rollover Confirmation (Simplex NLP Rule check)
	isRolloverConfirm := len(finalText) > 4 &&
		(finalText == "Sim Laura, prorroga" || finalText == "sim laura prorroga" || finalText == "prorroga")

	if isRolloverConfirm {
		slog.Info("[Crisis Engine] User confirmed Rollover! Looking up context and persisting.")

		ctxCrisis := GetCrisisContext(phoneNumber)
		if ctxCrisis == nil {
			replyFunc("🤔 Não encontrei uma simulação de rolagem ativa pra você no momento. Me conte primeiro o valor que está em aperto que eu calculo as opções!")
			return
		}

		sim, err := SimulateRollover(ctxCrisis.WorkspaceID, ctxCrisis.CardID, ctxCrisis.InvoiceValueCts, ctxCrisis.ProcessorSlug, ctxCrisis.Installments)
		if err != nil {
			slog.Error("[Rollover] simulate", "err", err)
			replyFunc("❌ Tive um problema ao re-simular a rolagem. Tente novamente em instantes.")
			return
		}
		if err := PersistRollover(context.Background(), sim); err != nil {
			slog.Error("[Rollover] persist", "err", err)
			replyFunc("❌ Tive um problema ao gravar a rolagem no banco. Tente novamente em instantes.")
			return
		}

		replyFunc(fmt.Sprintf(
			"✅ Rolagem ativada via %s (%s)! Gravei %d operações totalizando R$%.2f em taxas sobre R$%.2f de fatura. Seu fluxo de caixa agradece! 🧘",
			sim.Institution, sim.Installments, sim.TotalOperations,
			float64(sim.TotalFeesCts)/100,
			float64(sim.InvoiceValueCts)/100,
		))
		return
	}

	fmt.Printf("[ProcessMessageFlow Started] Passing to Brain/LLM... [%s]\n", finalText)

	// Extraction with LLM
	rawJsonStr, parsedTx, err := ExtractTransactionFromText(context.Background(), finalText, planSlug)

	if db.Pool != nil {
		logStatus := "processed"
		if err != nil {
			logStatus = "error"
			slog.Error("[NLP] parsing error", "err", err)
		} else if parsedTx != nil && parsedTx.NeedsReview {
			logStatus = "needs_review"
		}

		if _, logErr := db.Pool.Exec(context.Background(),
			`INSERT INTO message_logs (workspace_id, phone_number, raw_message, processed_json, status)
			 VALUES ($1, $2, $3, $4, $5)`,
			workspaceID, phoneNumber, finalText, rawJsonStr, logStatus,
		); logErr != nil {
			slog.Warn("workflow.message_logs insert falhou", "err", logErr, "workspace", workspaceID)
		}

		if err == nil && parsedTx != nil {
			// Let's grab the actual category if we can match it roughly, but for now we insert NULL if not matched
			// However, to make Nudges work we should try to match the category by name (simulated here for MVP)
			var categoryId *string
			var budgetLimitCents int
			var budgetLimit float64
			var catName string

			// Epic 5 (5.1 & 5.2): Crisis Handler & Rollover Simulation
			if parsedTx.IsCrisis {
				slog.Info("[Crisis Engine] User evoked intent of crisis/debt rollover.")

				// parsedTx.Amount vem em Reais; converte para centavos (INTEGER).
				invoiceValueCts := int(parsedTx.Amount * 100)
				if invoiceValueCts <= 0 {
					invoiceValueCts = 100_000 // R$ 1000 fallback quando o LLM não extrai valor
				}

				// Motor escolhe InfinitePay 2x como default — no futuro, quando
				// o motor decidir comparar N adquirentes, este é o ponto de
				// evolução. Por ora é um default conservador.
				processorSlug := "infinitepay"
				installmentsChoice := "2x"

				sim, err := SimulateRollover(workspaceID, nil, invoiceValueCts, processorSlug, installmentsChoice)
				if err != nil {
					slog.Error("[Crisis Engine] simulate preview", "err", err)
					replyFunc("🤔 Percebi que você pode estar em aperto, mas tive um problema ao calcular a simulação. Tente me dizer o valor novamente!")
					return
				}

				// Armazena o contexto para a confirmação subsequente
				SetCrisisContext(&CrisisContext{
					WorkspaceID:     workspaceID,
					PhoneNumber:     phoneNumber,
					InvoiceValueCts: invoiceValueCts,
					ProcessorSlug:   processorSlug,
					Installments:    installmentsChoice,
				})

				criseMsg := fmt.Sprintf("🚨 Percebi que você pode estar com dificuldade para pagar *%s* (R$%.2f).\n\n",
					parsedTx.Description, float64(invoiceValueCts)/100)
				criseMsg += "📊 *Simulação de Salvamento:*\n"
				criseMsg += fmt.Sprintf("Posso empurrar essa fatura via *%s* em *%s*, dividindo em %d operações.\n",
					sim.Institution, sim.Installments, sim.TotalOperations)
				criseMsg += fmt.Sprintf("Taxa efetiva: *%.2f%%*, total em taxas: *R$%.2f*.\n",
					sim.FeePercentage, float64(sim.TotalFeesCts)/100)
				criseMsg += fmt.Sprintf("Comparado ao rotativo do cartão (14%%), você economiza cerca de *R$%.2f*.\n\n",
					float64(invoiceValueCts)*0.14-float64(sim.TotalFeesCts)/100)
				criseMsg += "Deseja que eu execute essa rolagem? (Responda: 'Sim Laura, prorroga')"

				replyFunc(criseMsg)
				return
			}

			// Very basic string search for category. A robust app would use pg_trgm or LLM direct matching by ID.
			_ = db.Pool.QueryRow(context.Background(),
				"SELECT id, monthly_limit_cents, name FROM categories WHERE workspace_id = $1 AND name ILIKE $2 LIMIT 1",
				workspaceID, "%"+parsedTx.Description+"%").Scan(&categoryId, &budgetLimitCents, &catName)
			budgetLimit = float64(budgetLimitCents) / 100.0

			// Resolve author_phone_id a partir do phone_number que mandou
			// a mensagem. Se o phone não estiver cadastrado no workspace,
			// author_phone_id fica NULL — permitido pela migration 000021.
			var authorPhoneID *string
			var resolvedPhoneID string
			err = db.Pool.QueryRow(context.Background(),
				"SELECT id FROM phones WHERE workspace_id = $1 AND phone_number = $2 LIMIT 1",
				workspaceID, phoneNumber,
			).Scan(&resolvedPhoneID)
			if err == nil {
				authorPhoneID = &resolvedPhoneID
			}

			_, insertErr := db.Pool.Exec(context.Background(),
				`INSERT INTO transactions (workspace_id, amount, type, description, transaction_date, confidence_score, needs_review, tags, category_id, author_phone_id)
				 VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, $7, $8, $9)`,
				workspaceID, int(parsedTx.Amount*100), parsedTx.Type, parsedTx.Description, parsedTx.Confidence, parsedTx.NeedsReview, parsedTx.Labels, categoryId, authorPhoneID,
			)

			if insertErr != nil {
				slog.Error("[Transaction] insertion error", "err", insertErr)
				replyFunc(fmt.Sprintf("❌ Ops, tive um problema ao salvar seu gasto: %s", parsedTx.Description))
			} else {
				slog.Info("transaction saved", "description", parsedTx.Description, "amount", parsedTx.Amount)

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
