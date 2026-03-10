package models

type WebhookPayload struct {
	Event    string `json:"event"`
	Instance string `json:"instance"`
	Data     struct {
		Message struct {
			Conversation string `json:"conversation"` // Text content
			// Option 2: Some gateways send audio in message.audioMessage
			AudioMessage struct {
				Mimetype string `json:"mimetype"`
				Seconds  int    `json:"seconds"`
			} `json:"audioMessage,omitempty"`
			// Option 3: Base64 data encoded by Gateway (E.g Z-Api/Evolution)
			Base64 string `json:"base64,omitempty"`
		} `json:"message"`
		Key struct {
			RemoteJid string `json:"remoteJid"` // This contains the user phone number (e.g. 5511999999999@s.whatsapp.net)
			FromMe    bool   `json:"fromMe"`
		} `json:"key"`
		PushName string `json:"pushName"`
	} `json:"data"`
}
