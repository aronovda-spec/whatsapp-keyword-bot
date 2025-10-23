#!/bin/bash

# WhatsApp Keyword Bot - Quick Start Script
echo "🚀 WhatsApp Keyword Bot - Quick Start"
echo "======================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "📝 Creating .env from template..."
    cp env.example .env
    echo ""
    echo "🔧 Please configure your .env file:"
    echo "   1. Get Telegram bot token from @BotFather"
    echo "   2. Get your chat ID from @userinfobot"
    echo "   3. Add both to .env file"
    echo ""
    echo "📖 See CONFIGURATION.md for detailed instructions"
    echo ""
    read -p "Press Enter when you've configured .env file..."
fi

# Check if .env is configured
if grep -q "your_telegram_bot_token_here" .env; then
    echo "❌ Please configure your Telegram credentials in .env file first!"
    echo "📖 See CONFIGURATION.md for instructions"
    exit 1
fi

echo "✅ Environment configured"
echo ""

# Start the bot
echo "🤖 Starting WhatsApp Keyword Bot..."
echo "📱 You'll need to scan a QR code with WhatsApp"
echo "🌐 Dashboard will be available at: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop the bot"
echo ""

npm start
