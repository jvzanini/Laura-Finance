package whatsapp

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jvzanini/laura-finance/laura-go/internal/db"
	"github.com/jvzanini/laura-finance/laura-go/internal/services"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"

	_ "github.com/jackc/pgx/v5/stdlib"
)

var Client *whatsmeow.Client

func InitWhatsmeow() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Println("[WhatsApp] DATABASE_URL not set for whatsmeow, skipping WhatsApp connection..")
		return
	}

	dbLog := waLog.Stdout("Database", "WARN", true)
	// whatsmeow uses standard sql database driver, so we use postgres or pgx
	container, err := sqlstore.New(context.Background(), "pgx", dbURL, dbLog)
	if err != nil {
		log.Fatalf("Failed to connect to database for whatsmeow: %v", err)
	}

	deviceStore, err := container.GetFirstDevice(context.Background())
	if err != nil {
		log.Fatalf("Failed to get device store: %v", err)
	}

	clientLog := waLog.Stdout("Client", "INFO", true)
	Client = whatsmeow.NewClient(deviceStore, clientLog)

	Client.AddEventHandler(eventHandler)

	if Client.Store.ID == nil {
		log.Println("[WhatsApp] No active session found. We need to link a device.")
		qrChan, _ := Client.GetQRChannel(context.Background())
		err = Client.Connect()
		if err != nil {
			log.Fatalf("Failed to connect whatsmeow: %v", err)
		}

		go func() {
			for evt := range qrChan {
				if evt.Event == "code" {
					fmt.Printf("\n[WA Admin Setup] -> Scan this QR code in WhatsApp:\n%v\n\n", evt.Code)
					// In a production app with UI we could expose this via a secure WebSocket or endpoint,
					// but for now, the user wants this to be strictly admin-side. Reading it off terminal/logs is acceptable.
				} else {
					log.Printf("[WhatsApp] Login event: %s\n", evt.Event)
				}
			}
		}()
	} else {
		log.Println("[WhatsApp] Found existing session, reconnecting...")
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
	// Check users table or phones table for this number
	err := db.Pool.QueryRow(context.Background(), `
		SELECT workspace_id FROM users WHERE phone_number = $1
		UNION
		SELECT workspace_id FROM phones WHERE phone_number = $1
		LIMIT 1
	`, senderNumberStr).Scan(&workspaceId)

	if err != nil {
		log.Printf("[WhatsApp Auth Denied] Number %s not found in any workspace: %v\n", senderNumberStr, err)
		return
	}

	// Fire async workflow process!
	go services.ProcessMessageFlow(workspaceId, senderNumberStr, text, audioBytes)
}
