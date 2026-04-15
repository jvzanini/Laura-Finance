package whatsapp

import (
	"context"
	"encoding/base64"
	"fmt"
	"log/slog"
	"sync"

	"github.com/jvzanini/laura-finance/laura-go/internal/db"
	"github.com/mdp/qrterminal/v3"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"

	waProto "go.mau.fi/whatsmeow/binary/proto"
	"google.golang.org/protobuf/proto"

	"bytes"

	_ "github.com/lib/pq"
)

// WhatsAppInstance representa uma conexão WhatsApp individual.
type WhatsAppInstance struct {
	ID          string
	Name        string
	PhoneNumber string
	Status      string // disconnected, connecting, qr_pending, connected
	Client      *whatsmeow.Client
	container   *sqlstore.Container
	qrCode      string // último QR code gerado (base64 PNG ou texto)
	mu          sync.Mutex
}

// Manager gerencia múltiplas instâncias WhatsApp.
var Manager = &InstanceManager{
	instances: make(map[string]*WhatsAppInstance),
}

type InstanceManager struct {
	instances map[string]*WhatsAppInstance
	mu        sync.RWMutex
}

// GetInstance retorna uma instância por ID.
func (m *InstanceManager) GetInstance(id string) *WhatsAppInstance {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.instances[id]
}

// ListInstances retorna todas as instâncias.
func (m *InstanceManager) ListInstances() []*WhatsAppInstance {
	m.mu.RLock()
	defer m.mu.RUnlock()
	result := make([]*WhatsAppInstance, 0, len(m.instances))
	for _, inst := range m.instances {
		result = append(result, inst)
	}
	return result
}

// CreateInstance cria uma nova instância (sem conectar).
func (m *InstanceManager) CreateInstance(id, name string) (*WhatsAppInstance, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.instances[id]; exists {
		return nil, fmt.Errorf("instância %s já existe", id)
	}

	inst := &WhatsAppInstance{
		ID:     id,
		Name:   name,
		Status: "disconnected",
	}
	m.instances[id] = inst

	// Atualizar status no banco
	if db.Pool != nil {
		ctx := context.Background()
		db.Pool.Exec(ctx, "UPDATE whatsapp_instances SET status = 'disconnected' WHERE id = $1", id)
	}

	return inst, nil
}

// ConnectInstance conecta uma instância ao WhatsApp.
func (m *InstanceManager) ConnectInstance(id string) error {
	m.mu.RLock()
	inst, exists := m.instances[id]
	m.mu.RUnlock()

	if !exists {
		return fmt.Errorf("instância %s não encontrada", id)
	}

	inst.mu.Lock()
	defer inst.mu.Unlock()

	if inst.Client != nil && inst.Status == "connected" {
		return nil // já conectado
	}

	dbURL := db.GetDSN()
	dbLog := waLog.Stdout("Database", "ERROR", true)
	container, err := sqlstore.New(context.Background(), "postgres", dbURL, dbLog)
	if err != nil {
		return fmt.Errorf("falha ao conectar ao DB: %v", err)
	}
	inst.container = container

	deviceStore, err := container.GetFirstDevice(context.Background())
	if err != nil {
		return fmt.Errorf("falha ao obter device store: %v", err)
	}

	clientLog := &silentLogger{}
	inst.Client = whatsmeow.NewClient(deviceStore, clientLog)
	inst.Client.AddEventHandler(func(evt interface{}) {
		instanceEventHandler(inst, evt)
	})

	if inst.Client.Store.ID == nil {
		// Precisa de QR code
		inst.Status = "qr_pending"
		updateInstanceStatus(id, "qr_pending")

		qrChan, _ := inst.Client.GetQRChannel(context.Background())
		err = inst.Client.Connect()
		if err != nil {
			return fmt.Errorf("falha ao conectar: %v", err)
		}

		go func() {
			for evt := range qrChan {
				if evt.Event == "code" {
					inst.mu.Lock()
					inst.qrCode = evt.Code
					inst.Status = "qr_pending"
					inst.mu.Unlock()
					slog.Info("[WhatsApp] QR code gerado", "instance", inst.Name)
				} else if evt.Event == "success" {
					inst.mu.Lock()
					inst.Status = "connected"
					inst.qrCode = ""
					if inst.Client.Store.ID != nil {
						inst.PhoneNumber = inst.Client.Store.ID.User
					}
					inst.mu.Unlock()
					updateInstanceStatus(id, "connected")
					slog.Info("[WhatsApp] conectado", "instance", inst.Name)
				}
			}
		}()
	} else {
		// Sessão existente — reconectar
		inst.Status = "connecting"
		err = inst.Client.Connect()
		if err != nil {
			return fmt.Errorf("falha ao reconectar: %v", err)
		}
		inst.Status = "connected"
		if inst.Client.Store.ID != nil {
			inst.PhoneNumber = inst.Client.Store.ID.User
		}
		updateInstanceStatus(id, "connected")
	}

	// Manter compatibilidade: se for a primeira instância, setar como Client global
	if Client == nil {
		Client = inst.Client
	}

	return nil
}

// DisconnectInstance desconecta uma instância.
func (m *InstanceManager) DisconnectInstance(id string) error {
	m.mu.RLock()
	inst, exists := m.instances[id]
	m.mu.RUnlock()

	if !exists {
		return fmt.Errorf("instância %s não encontrada", id)
	}

	inst.mu.Lock()
	defer inst.mu.Unlock()

	if inst.Client != nil {
		inst.Client.Disconnect()
	}
	inst.Status = "disconnected"
	inst.qrCode = ""
	updateInstanceStatus(id, "disconnected")

	return nil
}

// RemoveInstance desconecta e remove uma instância.
func (m *InstanceManager) RemoveInstance(id string) error {
	if err := m.DisconnectInstance(id); err != nil {
		// ignora erro de disconnect
	}

	m.mu.Lock()
	delete(m.instances, id)
	m.mu.Unlock()

	return nil
}

// GetQRCode retorna o QR code atual de uma instância (texto).
func (m *InstanceManager) GetQRCode(id string) (string, error) {
	m.mu.RLock()
	inst, exists := m.instances[id]
	m.mu.RUnlock()

	if !exists {
		return "", fmt.Errorf("instância não encontrada")
	}

	inst.mu.Lock()
	defer inst.mu.Unlock()

	if inst.qrCode == "" {
		return "", fmt.Errorf("QR code não disponível (status: %s)", inst.Status)
	}

	// Gerar QR como texto para exibir no terminal/frontend
	var buf bytes.Buffer
	qrterminal.GenerateHalfBlock(inst.qrCode, qrterminal.L, &buf)
	return base64.StdEncoding.EncodeToString(buf.Bytes()), nil
}

// SendMessage envia mensagem por uma instância específica.
func (inst *WhatsAppInstance) SendMessage(phone, text string) error {
	if inst.Client == nil {
		return fmt.Errorf("cliente não conectado")
	}
	jid, err := types.ParseJID(phone + "@s.whatsapp.net")
	if err != nil {
		return err
	}
	_, err = inst.Client.SendMessage(context.Background(), jid, &waProto.Message{
		Conversation: proto.String(text),
	})
	return err
}

// ─── Event Handler por instância ───

func instanceEventHandler(inst *WhatsAppInstance, evt interface{}) {
	switch v := evt.(type) {
	case *events.Message:
		HandleIncomingMessage(v)
	case *events.Connected:
		inst.mu.Lock()
		inst.Status = "connected"
		if inst.Client != nil && inst.Client.Store.ID != nil {
			inst.PhoneNumber = inst.Client.Store.ID.User
		}
		inst.mu.Unlock()
		updateInstanceStatus(inst.ID, "connected")
		slog.Info("[WhatsApp] conectado", "instance", inst.Name)
	case *events.Disconnected:
		inst.mu.Lock()
		inst.Status = "disconnected"
		inst.mu.Unlock()
		updateInstanceStatus(inst.ID, "disconnected")
		slog.Warn("[WhatsApp] desconectado", "instance", inst.Name)
	case *events.LoggedOut:
		inst.mu.Lock()
		inst.Status = "disconnected"
		inst.mu.Unlock()
		if inst.Client != nil {
			inst.Client.Disconnect()
		}
		updateInstanceStatus(inst.ID, "disconnected")
		slog.Warn("[WhatsApp] logout detectado", "instance", inst.Name)
	}
}

// ─── Helpers ───

func updateInstanceStatus(id, status string) {
	if db.Pool == nil {
		return
	}
	ctx := context.Background()
	if status == "connected" {
		db.Pool.Exec(ctx, "UPDATE whatsapp_instances SET status = $1, last_connected_at = CURRENT_TIMESTAMP WHERE id = $2", status, id)
	} else if status == "disconnected" {
		db.Pool.Exec(ctx, "UPDATE whatsapp_instances SET status = $1, disconnected_at = CURRENT_TIMESTAMP WHERE id = $2", status, id)
	} else {
		db.Pool.Exec(ctx, "UPDATE whatsapp_instances SET status = $1 WHERE id = $2", status, id)
	}
}

// LoadInstancesFromDB carrega instâncias existentes do banco e tenta conectar as ativas.
func LoadInstancesFromDB() {
	if db.Pool == nil {
		return
	}
	ctx := context.Background()
	rows, err := db.Pool.Query(ctx, "SELECT id, name, phone_number, status FROM whatsapp_instances")
	if err != nil {
		slog.Error("[InstanceManager] Falha ao carregar instâncias", "err", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var id, name, status string
		var phone *string
		if err := rows.Scan(&id, &name, &phone, &status); err != nil {
			continue
		}
		inst := &WhatsAppInstance{
			ID:     id,
			Name:   name,
			Status: status,
		}
		if phone != nil {
			inst.PhoneNumber = *phone
		}
		Manager.mu.Lock()
		Manager.instances[id] = inst
		Manager.mu.Unlock()
	}

	slog.Info("[InstanceManager] instâncias carregadas", "count", len(Manager.instances))
}
