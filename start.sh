#!/bin/bash
set -e

# Cores para o output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}===========================================${NC}"
echo -e "${BLUE}  Inicializando Laura Finance MVP Vibe      ${NC}"
echo -e "${BLUE}===========================================${NC}"

# 1. Verifica/Pede a GROQ_API_KEY
if [ ! -f "laura-go/.env" ] || ! grep -q "GROQ_API_KEY" "laura-go/.env"; then
    echo -e "${YELLOW}A Inteligência Artificial precisa de um 'cérebro'.${NC}"
    echo -e "Crie uma chave de API 100% gratuita acessando: ${GREEN}https://console.groq.com/keys${NC}"
    echo -e ""
    read -p "▶ Cole sua GROQ_API_KEY aqui: " groq_key
    
    # Salva no arquivo .env do backend Go
    echo "DATABASE_URL=postgres://laura:laura_password@localhost:5433/laura_finance?sslmode=disable" > laura-go/.env
    echo "GROQ_API_KEY=$groq_key" >> laura-go/.env
    echo "PORT=8080" >> laura-go/.env
    echo -e "${GREEN}✔ Chave salva com segurança em laura-go/.env!${NC}\n"
fi

# 2. Sobe o Banco de Dados (Postgres com vetorização)
echo -e "${BLUE}[1/4] Subindo o Banco de Dados Seguro (Docker)...${NC}"
docker compose -f infrastructure/docker-compose.yml up -d postgres
echo -e "${YELLOW}Aguardando o banco de dados aquecer (5s)...${NC}"
sleep 5

# 3. Roda todas as Migrations (Tabelas do Banco de Dados)
echo -e "\n${BLUE}[2/4] Estruturando Tabelas e Esqueleto do Banco...${NC}"
for f in infrastructure/migrations/*.sql; do
    echo " - Aplicando $(basename "$f")..."
    # Executa o SQL direto dentro do container ligado
    docker compose -f infrastructure/docker-compose.yml exec -T postgres psql -U laura -d laura_finance < "$f" > /dev/null 2>&1 || true
done
echo -e "${GREEN}✔ Banco de dados pronto!${NC}"

# 4. Inicializa o Painel PWA no modo background
echo -e "\n${BLUE}[3/4] Inicializando o Painel Web (Next.js)...${NC}"
cd laura-pwa
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Primeira vez rodando: Instalando dependências do frontend (isso pode levar um minuto)...${NC}"
    npm install > /dev/null 2>&1
fi
npm run dev > /dev/null 2>&1 &
PWA_PID=$!
cd ..
echo -e "${GREEN}✔ Painel rodando em http://localhost:3000${NC}"

# 5. Roda o Bot (Go) no terminal atual para mostrar o QR Code
echo -e "\n${BLUE}[4/4] Inicializando o Cérebro da Laura (Engine Go + WhatsApp)...${NC}"
echo -e "${YELLOW}>>> ATENÇÃO: Pegue seu celular e prepare para escanear o QR Code que vai aparecer abaixo! <<<${NC}"
echo -e "${YELLOW}(Para desligar o sistema depois, aperte CTRL+C)${NC}\n"

# Garante que vai encerrar o Dashboard Web e o Docker quando você matar esse script (CTRL+C)
trap "echo -e '\n${BLUE}Desligando a Laura Finance...${NC}'; kill $PWA_PID; docker compose -f infrastructure/docker-compose.yml stop; exit 0" SIGINT SIGTERM

cd laura-go
go run main.go
