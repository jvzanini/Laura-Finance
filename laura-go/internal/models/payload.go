package models

type WebhookPayload struct {
	Event    string `json:"event"`
	Instance string `json:"instance"`
	Data     struct {
		Message struct {
			Conversation string `json:"conversation"` // Text content
			// We can also check for extended text (audio base64 etc) here later
		} `json:"message"`
		Key struct {
			RemoteJid string `json:"remoteJid"` // This contains the user phone number (e.g. 5511999999999@s.whatsapp.net)
			FromMe    bool   `json:"fromMe"`
		} `json:"key"`
		PushName string `json:"pushName"`
	} `json:"data"`
}
