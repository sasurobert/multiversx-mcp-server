#!/bin/bash
set -e

echo "============================================"
echo " MultiversX MCP Server — Setup"
echo "============================================"

# Prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js not found. Install v18+."; exit 1; }
NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
[ "$NODE_MAJOR" -ge 18 ] 2>/dev/null || echo "⚠ Node.js v18+ recommended (found $(node -v))"

echo "✓ node $(node -v), npm $(npm -v)"

# Install
echo "📦 Installing dependencies..."
npm install

# Config
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "⚙️  Created .env from .env.example — edit before running"
    else
        cat > .env << 'EOF'
MVX_NETWORK=devnet
MVX_SIGNING_MODE=pem
EOF
        echo "⚙️  Created default .env"
    fi
fi

# Build
echo "🔨 Building..."
npm run build

# Test
echo "🧪 Running tests..."
npm test

echo ""
echo "✅ Setup complete!"
echo "   Run MCP mode:  npm start"
echo "   Run HTTP mode: npm run start:http"
