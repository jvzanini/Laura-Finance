# Story 4.2: Respostas Estáticas e Feedbacks de Gasto (Nudges)

Status: done

## Story
As an Usuário
I want que assim que eu registrar um gasto com sucesso, eu receba um "Check" de que deu certo e um aviso rápido se eu estiver chegando perto do fim do orçamento (ex: "Anotado! Restam R$200 de Lazer")
So that eu molde meu comportamento de gasto.

## Tasks / Subtasks
- [x] Quando a transação for salva sem `NeedsReview`, calcular a soma gasta do workspace no mês para a mesma categoria.
- [x] Comparar com o limite da `categories`. Se o Lembrete de orcamento for ultrapassar 80% ou 100%, engatilhar um Nudge/Aviso.
- [x] Retornar a mensagem no WhatsApp como "✅ Anotado: X reais. ⚠️ Atenção: você já gastou Y% do teto desse mês!".
