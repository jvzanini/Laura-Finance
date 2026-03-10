# Story 3.4: Sistema Customizado Tags Multivariadas

Status: done

## Story
As an Usuário
I want poder pedir para a IA adicionar labels personalizados aos meus gastos (ex: #viagem-sao-paulo)
So that no futuro eu consiga agrupar os relatórios além das categorias convencionais.

## Tasks / Subtasks
- [x] Adicionar coluna `tags TEXT[]` na tabela de `transactions`
- [x] Atualizar o prompt do `ExtractTransactionFromText` no Groq para extrair array de tags baseadas em "#" e no contexto de "tags" e salvar
- [x] Atualizar a UI do `RecentTransactionsFeed` para exibir as Tags com badges estilosos.
