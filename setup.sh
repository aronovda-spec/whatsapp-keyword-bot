#!/bin/bash

# WhatsApp Keyword Bot - Setup Script
echo "🚀 Setting up WhatsApp Keyword Bot..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p sessions
mkdir -p logs
mkdir -p config

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp env.example .env
    echo "📝 Please edit .env file with your Telegram bot credentials"
    echo "   - Get bot token from @BotFather on Telegram"
    echo "   - Get chat ID by messaging @userinfobot"
else
    echo "✅ .env file found"
fi

# Check if config files exist
if [ ! -f config/keywords.json ]; then
    echo "⚠️  keywords.json not found. Creating default..."
    # This should already exist from our setup
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your Telegram credentials"
echo "2. Customize keywords in config/keywords.json"
echo "3. Run: npm start"
echo "4. Scan QR code with WhatsApp"
echo ""
echo "📚 For deployment to Render:"
echo "1. Push code to GitHub"
echo "2. Connect repository to Render"
echo "3. Set environment variables in Render dashboard"
echo "4. Deploy!"
