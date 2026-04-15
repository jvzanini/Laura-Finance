package whatsapp

import (
	"sync"
	"testing"
	"time"
)

func TestInstanceManager_IsConnected_NilClient(t *testing.T) {
	saved := Client
	Client = nil
	defer func() { Client = saved }()

	m := &InstanceManager{instances: map[string]*WhatsAppInstance{}}
	if m.IsConnected() {
		t.Error("IsConnected deveria ser false com Client nil")
	}
}

func TestInstanceManager_LastSeen_Touch(t *testing.T) {
	m := &InstanceManager{instances: map[string]*WhatsAppInstance{}}
	if !m.LastSeen().IsZero() {
		t.Error("LastSeen inicial deveria ser zero")
	}
	before := time.Now()
	m.TouchLastSeen()
	if m.LastSeen().Before(before) {
		t.Errorf("LastSeen %v antes de Touch %v", m.LastSeen(), before)
	}
}

func TestInstanceManager_LastSeen_Concurrent(t *testing.T) {
	m := &InstanceManager{instances: map[string]*WhatsAppInstance{}}
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(2)
		go func() { defer wg.Done(); m.TouchLastSeen() }()
		go func() { defer wg.Done(); _ = m.LastSeen() }()
	}
	wg.Wait()
	if m.LastSeen().IsZero() {
		t.Error("LastSeen deveria estar populado")
	}
}

func TestInstanceManager_GetInstance_NotFound(t *testing.T) {
	m := &InstanceManager{instances: map[string]*WhatsAppInstance{}}
	if m.GetInstance("non-existent") != nil {
		t.Error("esperava nil para ID inexistente")
	}
}

func TestInstanceManager_GetInstance_Found(t *testing.T) {
	inst := &WhatsAppInstance{ID: "abc", Name: "test", Status: "disconnected"}
	m := &InstanceManager{instances: map[string]*WhatsAppInstance{"abc": inst}}
	got := m.GetInstance("abc")
	if got == nil || got.ID != "abc" {
		t.Errorf("got %+v", got)
	}
}

func TestInstanceManager_ListInstances_Empty(t *testing.T) {
	m := &InstanceManager{instances: map[string]*WhatsAppInstance{}}
	got := m.ListInstances()
	if len(got) != 0 {
		t.Errorf("esperava 0 instâncias, got %d", len(got))
	}
}

func TestInstanceManager_ListInstances_Multi(t *testing.T) {
	m := &InstanceManager{instances: map[string]*WhatsAppInstance{
		"a": {ID: "a"},
		"b": {ID: "b"},
		"c": {ID: "c"},
	}}
	got := m.ListInstances()
	if len(got) != 3 {
		t.Errorf("esperava 3 instâncias, got %d", len(got))
	}
}

func TestInstanceManager_CreateInstance_Duplicate(t *testing.T) {
	m := &InstanceManager{instances: map[string]*WhatsAppInstance{
		"dup": {ID: "dup"},
	}}
	_, err := m.CreateInstance("dup", "outro nome")
	if err == nil {
		t.Error("esperava erro para ID duplicado")
	}
}

func TestInstanceManager_RemoveInstance_Idempotent(t *testing.T) {
	// RemoveInstance ignora disconnect err e sempre retorna nil.
	m := &InstanceManager{instances: map[string]*WhatsAppInstance{}}
	if err := m.RemoveInstance("nope"); err != nil {
		t.Errorf("remove inexistente deveria ser no-op, got %v", err)
	}
}

func TestInstanceManager_GetQRCode_NotFound(t *testing.T) {
	m := &InstanceManager{instances: map[string]*WhatsAppInstance{}}
	_, err := m.GetQRCode("nope")
	if err == nil {
		t.Error("esperava erro")
	}
}

func TestInstanceManager_GetQRCode_Stored(t *testing.T) {
	inst := &WhatsAppInstance{ID: "a", qrCode: "qr-payload"}
	m := &InstanceManager{instances: map[string]*WhatsAppInstance{"a": inst}}
	got, err := m.GetQRCode("a")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if got == "" {
		t.Error("esperava base64 QR não vazio")
	}
}

func TestInstanceManager_GetQRCode_Empty(t *testing.T) {
	inst := &WhatsAppInstance{ID: "a", qrCode: "", Status: "connecting"}
	m := &InstanceManager{instances: map[string]*WhatsAppInstance{"a": inst}}
	_, err := m.GetQRCode("a")
	if err == nil {
		t.Error("esperava erro quando qrCode vazio")
	}
}

func TestInstanceManager_DisconnectInstance_NotFound(t *testing.T) {
	m := &InstanceManager{instances: map[string]*WhatsAppInstance{}}
	if err := m.DisconnectInstance("nope"); err == nil {
		t.Error("esperava erro")
	}
}

func TestInstanceManager_ConnectInstance_NotFound(t *testing.T) {
	m := &InstanceManager{instances: map[string]*WhatsAppInstance{}}
	if err := m.ConnectInstance("nope"); err == nil {
		t.Error("esperava erro")
	}
}

func TestWhatsAppInstance_QRCode(t *testing.T) {
	inst := &WhatsAppInstance{ID: "x"}
	inst.mu.Lock()
	inst.qrCode = "data:base64,abc"
	inst.mu.Unlock()
	inst.mu.Lock()
	got := inst.qrCode
	inst.mu.Unlock()
	if got != "data:base64,abc" {
		t.Errorf("got %q", got)
	}
}
