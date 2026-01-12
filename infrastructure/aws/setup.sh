#!/bin/bash
# SoulPrint LLM Server Setup Script
# Runs on EC2 instance startup

set -e

# Log everything
exec > >(tee /var/log/soulprint-setup.log) 2>&1

echo "=== SoulPrint LLM Setup Starting ==="
date

# Variables from Terraform
HF_TOKEN="${hf_token}"

# Update system
apt-get update
apt-get upgrade -y

# Install Python dependencies
pip install --upgrade pip
pip install vllm ray huggingface_hub

# Login to HuggingFace
echo "Logging into HuggingFace..."
huggingface-cli login --token $HF_TOKEN --add-to-git-credential

# Create systemd service for vLLM
cat > /etc/systemd/system/vllm.service << 'EOF'
[Unit]
Description=vLLM OpenAI-Compatible Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root
Environment="HF_HOME=/root/.cache/huggingface"
ExecStart=/usr/local/bin/python -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen2.5-72B-Instruct \
    --tensor-parallel-size 8 \
    --host 0.0.0.0 \
    --port 8000 \
    --max-model-len 32768 \
    --gpu-memory-utilization 0.95 \
    --trust-remote-code \
    --dtype auto
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
systemctl daemon-reload

# Download model first (can take 30+ minutes)
echo "Pre-downloading Qwen 2.5 72B model..."
python -c "
from huggingface_hub import snapshot_download
snapshot_download('Qwen/Qwen2.5-72B-Instruct', local_dir='/root/.cache/huggingface/hub/models--Qwen--Qwen2.5-72B-Instruct')
print('Model downloaded successfully!')
"

# Start vLLM service
echo "Starting vLLM service..."
systemctl enable vllm
systemctl start vllm

# Wait for server to be ready
echo "Waiting for vLLM server to start..."
for i in {1..60}; do
    if curl -s http://localhost:8000/health > /dev/null; then
        echo "vLLM server is ready!"
        break
    fi
    echo "Waiting... ($i/60)"
    sleep 10
done

# Create health check endpoint
cat > /root/health_check.py << 'HEALTH_EOF'
#!/usr/bin/env python3
import http.server
import socketserver
import subprocess
import json

class HealthHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            # Check if vLLM is responding
            try:
                result = subprocess.run(
                    ['curl', '-s', 'http://localhost:8000/health'],
                    capture_output=True,
                    timeout=5
                )
                if result.returncode == 0:
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "healthy"}).encode())
                else:
                    self.send_response(503)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "unhealthy"}).encode())
            except:
                self.send_response(503)
                self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

PORT = 8080
with socketserver.TCPServer(("", PORT), HealthHandler) as httpd:
    httpd.serve_forever()
HEALTH_EOF

echo "=== SoulPrint LLM Setup Complete ==="
date
