package services

// TranscribeAudio mantém a assinatura original para compatibilidade.
// Usa o provider do plano standard (Groq Whisper por default).
func TranscribeAudio(audioData []byte, filename string) (string, error) {
	return TranscribeAudioForPlan(audioData, filename, "standard")
}
