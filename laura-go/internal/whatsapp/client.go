package whatsapp

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/jvzanini/laura-finance/laura-go/internal/db"
	"github.com/jvzanini/laura-finance/laura-go/internal/services"
	"github.com/mdp/qrterminal/v3"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"

	waProto "go.mau.fi/whatsmeow/binary/proto"
	"google.golang.org/protobuf/proto"

	_ "github.com/lib/pq"
)

var Client *whatsmeow.Client

type silentLogger struct{}

func (l *silentLogger) Errorf(msg string, args ...interface{}) {
	formatted := fmt.Sprintf(msg, args...)
	if strings.Contains(formatted, "app state") || strings.Contains(formatted, "didn't find app state key") {
		return
	}
	log.Printf("[WhatsApp Error] %s\n", formatted)
}
func (l *silentLogger) Warnf(msg string, args ...interface{})  {}
func (l *silentLogger) Infof(msg string, args ...interface{})  {}
func (l *silentLogger) Debugf(msg string, args ...interface{}) {}
func (l *silentLogger) Sub(module string) waLog.Logger         { return l }

func InitWhatsmeow() {
	dbURL := db.GetDSN()

	dbLog := waLog.Stdout("Database", "ERROR", true)
	// whatsmeow uses standard sql database driver, so we use postgres or pgx
	container, err := sqlstore.New(context.Background(), "postgres", dbURL, dbLog)
	if err != nil {
		log.Fatalf("Failed to connect to database for whatsmeow: %v", err)
	}

	deviceStore, err := container.GetFirstDevice(context.Background())
	if err != nil {
		log.Fatalf("Failed to get device store: %v", err)
	}

	clientLog := &silentLogger{}
	Client = whatsmeow.NewClient(deviceStore, clientLog)

	// VERY IMPORTANT: Do not fetch all old message history or app states blindly
	// This prevents the "didn't find app state key" EOF errors on fresh connections
	Client.AddEventHandler(eventHandler)
	_ = Client.SendPresence(context.Background(), types.PresenceUnavailable)

	if Client.Store.ID == nil {
		log.Println("[WhatsApp] No active session found. We need to link a device.")
		qrChan, _ := Client.GetQRChannel(context.Background())
		err = Client.Connect()
		if err != nil {
			log.Fatalf("Failed to connect whatsmeow: %v", err)
		}

		go func() {
			ticker := time.NewTicker(1 * time.Second)
			defer ticker.Stop()
			timeLeft := 40
			isFirstCycle := true

			for {
				select {
				case evt, ok := <-qrChan:
					if !ok {
						fmt.Println("\n🚀 Instância conectada com sucesso!")
						fmt.Println("⚠️ O histórico de conversas não foi sincronizado (Configuração padrão)")
						return
					}
					if evt.Event == "code" {
						fmt.Print("\033[H\033[2J") // Clear terminal screen
						fmt.Println("[WA Admin Setup] -> Scan this QR code in WhatsApp:")
						qrterminal.GenerateHalfBlock(evt.Code, qrterminal.L, os.Stdout)
						fmt.Println()

						if !isFirstCycle {
							fmt.Println("🔄 QR Code Atualizado!")
							fmt.Println()
						}

						// Sempre reimprime o progresso atual do contador se ele sofrer atualização surpresa do Whatsapp
						if timeLeft <= 40 {
							fmt.Println("⚠️ O QR Code será atualizado em 40 segundos!⚠️")
						}
						// Usamos < e não <= para os outros, pois o ticker exato de 30 vai estampar a linha.
						if timeLeft < 30 {
							fmt.Println("⚠️ O QR Code será atualizado em 30 segundos!⚠️")
						}
						if timeLeft < 20 {
							fmt.Println("⚠️ O QR Code será atualizado em 20 segundos!⚠️")
						}
						if timeLeft < 10 {
							fmt.Println("⚠️ O QR Code será atualizado em 10 segundos!⚠️")
						}
						if timeLeft < 5 {
							fmt.Println("⚠️ O QR Code será atualizado em 5 segundos!⚠️")
						}
					} else {
						// Only log relevant strings that are not empty
						if evt.Event != "" && evt.Event != "success" {
							log.Printf("[WhatsApp] Status de Login: %s\n", evt.Event)
						}
					}
				case <-ticker.C:
					// Se já estiver logado, não tem por que rodar a atualização
					if Client.Store.ID != nil {
						return
					}

					timeLeft--
					if timeLeft == 30 || timeLeft == 20 || timeLeft == 10 || timeLeft == 5 {
						fmt.Printf("⚠️ O QR Code será atualizado em %d segundos!⚠️\n", timeLeft)
					}

					if timeLeft <= 0 {
						timeLeft = 40 // Previne loop até regerar
						isFirstCycle = false
						Client.Disconnect()
						time.Sleep(1 * time.Second) // Aguarda socket desligar
						_ = Client.Connect()
					}
				}
			}
		}()
	} else {
		log.Println("\n[WhatsApp] ⚡ Sessão ativa encontrada no banco de dados! Reconectando de forma invisível...")
		err = Client.Connect()
		if err != nil {
			log.Fatalf("Failed to connect whatsmeow: %v", err)
		}
	}
}

func eventHandler(evt interface{}) {
	switch v := evt.(type) {
	case *events.Message:
		HandleIncomingMessage(v)
	case *events.Connected:
		log.Println("\n[WhatsApp] 🟢 Conexão com os servidores estabelecida com sucesso!")
	case *events.OfflineSyncCompleted:
		log.Println("\n[WhatsApp] 📥 Sincronização offline concluída!")
	case *events.Disconnected:
		log.Println("\n[WhatsApp] 🔴 Desconectado dos servidores (tentando reconectar...)")
	case *events.StreamReplaced:
		log.Println("\n[WhatsApp] 🔁 Sessão substituída (O WhatsApp foi aberto em outro local de forma conflitante)")
	case *events.LoggedOut:
		log.Println("\n[WhatsApp] 🛑 Você foi desconectado via celular! APAGANDO sessão inútil...")
		Client.Disconnect()
		Client.Store.Delete(context.Background())
	}
}

func HandleIncomingMessage(msg *events.Message) {
	// Skip messages from the bot itself or empty
	if msg.Message == nil || msg.Info.IsFromMe {
		return
	}

	senderNumberStr := msg.Info.Sender.User // Gets the number cleanly, e.g. 5511999999999

	text := ""
	var audioBytes []byte

	if msg.Message.GetConversation() != "" {
		text = msg.Message.GetConversation()
	} else if msg.Message.GetExtendedTextMessage() != nil {
		text = msg.Message.GetExtendedTextMessage().GetText()
	} else if msg.Message.GetAudioMessage() != nil {
		audioBytes, _ = Client.Download(context.Background(), msg.Message.GetAudioMessage())
	}

	if text == "" && len(audioBytes) == 0 {
		return
	}

	log.Printf("[WhatsApp] Received Message from %s\n", senderNumberStr)

	// Auth: Determine Workspace
	if db.Pool == nil {
		log.Println("[App Error] DB Pool is not connected, cannot process messaging.")
		return
	}

	var workspaceId string
	// Check phones table for this number
	err := db.Pool.QueryRow(context.Background(), `
		SELECT workspace_id FROM phones WHERE phone_number = $1
		LIMIT 1
	`, senderNumberStr).Scan(&workspaceId)

	if err != nil {
		log.Printf("[WhatsApp Auth Denied] Number %s not found in any workspace: %v\n", senderNumberStr, err)
		return
	}

	replyFunc := func(replyText string) {
		jid, parseErr := types.ParseJID(senderNumberStr + "@s.whatsapp.net")
		if parseErr == nil && Client != nil {
			msgProto := &waProto.Message{
				Conversation: proto.String(replyText),
			}
			Client.SendMessage(context.Background(), jid, msgProto)
		}
	}

	// Fire async workflow process!
	go services.ProcessMessageFlow(workspaceId, senderNumberStr, text, audioBytes, replyFunc)
}

// SendTextMessage is an exported utility to allow outside services (like Cron) to send messages
func SendTextMessage(phoneNumber string, text string) {
	if Client == nil {
		return
	}
	jid, err := types.ParseJID(phoneNumber + "@s.whatsapp.net")
	if err == nil {
		Client.SendMessage(context.Background(), jid, &waProto.Message{
			Conversation: proto.String(text),
		})
	}
}

// ValidateWhatsAppNumber checks if a number exists on WhatsApp and returns its proper JID, e.g. "5511999999999", "error"
func ValidateWhatsAppNumber(phone string) (string, error) {
	if Client == nil {
		return "", fmt.Errorf("whatsapp client not initialized")
	}

	resp, err := Client.IsOnWhatsApp(context.Background(), []string{phone})
	if err != nil {
		return "", fmt.Errorf("failed to query whatsapp servers: %v", err)
	}

	for _, item := range resp {
		if item.IsIn {
			return item.JID.User, nil // User component is just the numbers "5511999999999"
		}
	}

	return "", fmt.Errorf("number is not registered on whatsapp")
}
