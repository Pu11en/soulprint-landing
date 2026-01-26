#!/bin/bash
# 🚀 BEDROCK QUICK-ENABLE
# Run this to add Bedrock config to your .env.local

echo "🚀 SoulPrint Bedrock Quick-Enable"
echo "================================="

ENV_FILE=".env.local"

# Check if BEDROCK_MODEL_ID already set
if grep -q "BEDROCK_MODEL_ID" "$ENV_FILE" 2>/dev/null; then
    echo "✅ BEDROCK_MODEL_ID already configured!"
    grep "BEDROCK_MODEL_ID" "$ENV_FILE"
else
    echo ""
    echo "Adding Bedrock config to $ENV_FILE..."
    echo "" >> "$ENV_FILE"
    echo "# AWS Bedrock (Added by enable-bedrock.sh)" >> "$ENV_FILE"
    echo "BEDROCK_MODEL_ID=us.anthropic.claude-3-5-haiku-20241022-v1:0" >> "$ENV_FILE"
    echo "✅ Added BEDROCK_MODEL_ID to $ENV_FILE"
fi

echo ""
echo "📋 REMAINING STEPS:"
echo "1. Go to: https://console.aws.amazon.com/bedrock/"
echo "2. Region: us-east-1"
echo "3. Click 'Model access' in sidebar"
echo "4. Request access to: Claude 3.5 Haiku"
echo "5. Wait ~1 min for approval"
echo "6. Deploy to Vercel with same env var"
echo ""
echo "Then your chat will work! 🎉"
