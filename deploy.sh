#!/bin/bash
# Script de deploy CIS - Valemilk
# Execute na VPS com: bash deploy.sh

set -e

echo "🚀 Iniciando deploy do CIS..."

# Parar containers existentes
echo "📦 Parando containers antigos..."
docker-compose down 2>/dev/null || true

# Construir imagens
echo "🔨 Construindo imagens Docker..."
docker-compose build --no-cache

# Iniciar containers
echo "🏃 Iniciando containers..."
docker-compose up -d

# Aguardar inicialização
echo "⏳ Aguardando serviços iniciarem..."
sleep 10

# Verificar status
echo "✅ Verificando status dos containers..."
docker-compose ps

# Testar health check do backend
echo "🔍 Testando backend..."
curl -s http://localhost:5888/health || echo "⚠️  Backend não respondeu"

echo ""
echo "🎉 Deploy concluído!"
echo ""
echo "📌 Acesse a aplicação em:"
echo "   http://72.61.62.17:8886"
echo ""
echo "📧 Credenciais de teste:"
echo "   comprador@valemilk.com / comprador123"
echo "   diretoria@valemilk.com / diretoria123"
echo "   admin@valemilk.com / admin123"
echo ""
echo "📋 Comandos úteis:"
echo "   docker-compose logs -f          # Ver logs"
echo "   docker-compose restart          # Reiniciar"
echo "   docker-compose down             # Parar"
