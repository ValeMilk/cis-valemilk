#!/bin/bash
# Script para configurar firewall e abrir portas do CIS

echo "🔥 Configurando firewall..."

# Verificar se ufw está instalado
if command -v ufw &> /dev/null; then
    echo "📦 UFW detectado"
    
    # Abrir portas
    sudo ufw allow 8886/tcp comment 'CIS Frontend'
    sudo ufw allow 5888/tcp comment 'CIS Backend'
    sudo ufw allow 22/tcp comment 'SSH'
    
    # Recarregar
    sudo ufw reload
    
    echo "✅ Portas abertas no UFW:"
    sudo ufw status
    
elif command -v firewall-cmd &> /dev/null; then
    echo "📦 Firewalld detectado"
    
    # Abrir portas
    sudo firewall-cmd --permanent --add-port=8886/tcp
    sudo firewall-cmd --permanent --add-port=5888/tcp
    sudo firewall-cmd --permanent --add-port=22/tcp
    
    # Recarregar
    sudo firewall-cmd --reload
    
    echo "✅ Portas abertas no Firewalld:"
    sudo firewall-cmd --list-ports
    
elif command -v iptables &> /dev/null; then
    echo "📦 iptables detectado"
    
    # Abrir portas
    sudo iptables -A INPUT -p tcp --dport 8886 -j ACCEPT
    sudo iptables -A INPUT -p tcp --dport 5888 -j ACCEPT
    sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
    
    # Salvar regras
    if command -v netfilter-persistent &> /dev/null; then
        sudo netfilter-persistent save
    elif [ -f /etc/sysconfig/iptables ]; then
        sudo service iptables save
    fi
    
    echo "✅ Regras iptables aplicadas"
    sudo iptables -L -n
    
else
    echo "⚠️  Nenhum firewall detectado (UFW/Firewalld/iptables)"
fi

echo ""
echo "🧪 Testando portas..."
netstat -tlnp | grep -E ':(8886|5888) '

echo ""
echo "✅ Configuração concluída!"
echo "Tente acessar: http://72.61.62.17:8886"
