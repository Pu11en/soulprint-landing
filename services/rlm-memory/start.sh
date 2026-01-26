#!/bin/bash
# Start the RLM Memory Service

cd "$(dirname "$0")"

# Create venv if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "📦 Creating Python virtual environment with uv..."
    uv venv --python 3.12
    source .venv/bin/activate
    uv pip install -r requirements.txt
    uv pip install -e ../../lib/rlm-core
else
    source .venv/bin/activate
fi

# Load environment variables from root .env.local
if [ -f "../../.env.local" ]; then
    set -a
    source ../../.env.local
    set +a
    echo "✅ Loaded .env.local"
fi

echo "🧠 Starting RLM Memory Service..."
echo "📍 AWS Region: $AWS_REGION"
echo "📍 Bedrock Model: $BEDROCK_MODEL_ID"
python main.py
