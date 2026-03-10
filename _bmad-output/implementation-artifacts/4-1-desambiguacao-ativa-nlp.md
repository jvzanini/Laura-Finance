# Story 4.1: Desambiguação Ativa NLP via WhatsApp

Status: done

## Story
As an Usuário
I want que a IA me pergunte de volta pelo WhatsApp caso ela não tenha entendido direito um gasto
So that os dados no Dashboard não fiquem bagunçados ou com categoria 'Geral'.

## Tasks / Subtasks
- [x] Ajustar `ProcessMessageFlow` para injetar um callback `reply string -> void` na função para podermos enviar respostas sem injetar dependência circular.
- [x] Implementar envio de msg nativa `waE2E.Message` no `whatsapp/client.go` conectado a esse callback.
- [x] Se `NeedsReview == true`, em vez de apenas salvar mudo, enviar uma mensagem no zap "🤔 Não entendi muito bem. Você quis dizer X?" e marcar como Pending Confimation.
