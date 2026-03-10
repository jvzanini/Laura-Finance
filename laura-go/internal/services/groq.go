package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
)

// TranscribeAudio sends a raw audio block to Groq whisper API to transcribe into text
func TranscribeAudio(audioData []byte, filename string) (string, error) {
	apiKey := os.Getenv("GROQ_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("GROQ_API_KEY environment variable is not set")
	}

	url := "https://api.groq.com/openai/v1/audio/transcriptions"

	// Create multipart buffer
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Add file field
	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return "", fmt.Errorf("error creating form file: %v", err)
	}

	_, err = io.Copy(part, bytes.NewReader(audioData))
	if err != nil {
		return "", fmt.Errorf("error copying audio data: %v", err)
	}

	// Add model field
	_ = writer.WriteField("model", "whisper-large-v3-turbo")

	// Set language (optional, but good for pt-BR context)
	_ = writer.WriteField("language", "pt")

	if err := writer.Close(); err != nil {
		return "", err
	}

	req, err := http.NewRequest("POST", url, body)
	if err != nil {
		return "", fmt.Errorf("error building request: %v", err)
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed calling Groq API: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("groq API error (status %d): %s", resp.StatusCode, respBody)
	}

	var result struct {
		Text string `json:"text"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("error decoding Groq response: %v", err)
	}

	return result.Text, nil
}
