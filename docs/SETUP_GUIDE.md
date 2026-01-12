# SoulPrint Compete Stack - Step-by-Step Setup Guide

## Overview

This guide walks you through setting up the complete SoulPrint Compete Stack:
1. AWS Infrastructure (g5.48xlarge + vLLM + Qwen 72B)
2. mem0 Memory System
3. Database Migrations
4. Environment Configuration
5. Testing & Deployment

---

## Prerequisites

Before starting, ensure you have:

- [ ] AWS Account with ability to launch g5.48xlarge instances
- [ ] HuggingFace account with access to Qwen models
- [ ] Terraform installed (`brew install terraform` or [terraform.io](https://terraform.io))
- [ ] Supabase project (you already have this)
- [ ] Node.js 18+ installed

---

## Step 1: Environment Setup

### 1.1 Create Environment Variables

Add these to your `.env.local`:

```bash
# === COMPETE STACK CONFIG ===

# AWS vLLM (will be set after Terraform deployment)
AWS_LLM_ENDPOINT=https://your-alb-dns.amazonaws.com
AWS_LLM_API_KEY=sk-soulprint-internal-your-secret
AWS_LLM_MODEL=Qwen/Qwen2.5-72B-Instruct

# mem0 (Optional - uses Supabase fallback if not set)
# MEM0_API_KEY=your-mem0-api-key
# MEM0_SELF_HOSTED_URL=http://localhost:8080

# Feature Flags
ENABLE_COMPETE_STACK=true
ENABLE_PERSONALITY_DETECTION=true
ENABLE_EMOTION_DETECTION=true
ENABLE_FINETUNING_LOGGING=true

# HuggingFace (for model download)
HF_TOKEN=your-huggingface-token
```

### 1.2 Get HuggingFace Token

1. Go to https://huggingface.co/settings/tokens
2. Create a new token with "Read" access
3. Accept the Qwen model license at https://huggingface.co/Qwen/Qwen2.5-72B-Instruct

---

## Step 2: Database Migration

### 2.1 Run the Migration

```bash
# Option A: Via Supabase CLI
supabase db push

# Option B: Via SQL Editor in Supabase Dashboard
# 1. Go to SQL Editor in your Supabase dashboard
# 2. Copy contents of supabase/migrations/20260112000001_compete_stack_tables.sql
# 3. Run the query
```

### 2.2 Verify Tables Created

In Supabase SQL Editor, run:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('user_memories', 'user_personality_profile', 'finetuning_data', 'chat_sessions');
```

Should return 4 rows.

---

## Step 3: AWS Infrastructure Deployment

### 3.1 Configure Terraform Variables

Create `infrastructure/aws/terraform.tfvars`:

```hcl
aws_region   = "us-east-1"
instance_type = "g5.48xlarge"
hf_token     = "your-huggingface-token"
```

### 3.2 Deploy Infrastructure

```bash
cd infrastructure/aws

# Initialize Terraform
terraform init

# Preview what will be created
terraform plan

# Deploy (this will take 5-10 minutes)
terraform apply
```

### 3.3 Save the Outputs

After deployment, Terraform will output:

```
alb_dns_name = "soulprint-llm-alb-xxxxxxxx.us-east-1.elb.amazonaws.com"
instance_id = "i-xxxxxxxxxxxxxxxxx"
instance_public_ip = "x.x.x.x"
```

Update your `.env.local`:
```bash
AWS_LLM_ENDPOINT=http://soulprint-llm-alb-xxxxxxxx.us-east-1.elb.amazonaws.com
```

### 3.4 Wait for Model Download

The first startup takes ~30-45 minutes to download the 72B model. Monitor progress:

```bash
# SSH into the instance
ssh -i your-key.pem ubuntu@<instance_public_ip>

# Check setup logs
tail -f /var/log/soulprint-setup.log

# Check vLLM status
sudo systemctl status vllm

# Check vLLM logs
sudo journalctl -u vllm -f
```

### 3.5 Verify vLLM is Running

```bash
# From your local machine
curl http://<alb_dns_name>/health

# Should return: {"status": "healthy"}

# Test a completion
curl http://<alb_dns_name>/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen2.5-72B-Instruct",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

---

## Step 4: mem0 Setup (Optional)

You have two options for memory:

### Option A: Use Supabase Fallback (Default)

No additional setup needed. Memories are stored in `user_memories` table.

### Option B: Use mem0 Cloud

1. Sign up at https://mem0.ai
2. Get your API key
3. Add to `.env.local`:
   ```bash
   MEM0_API_KEY=your-mem0-api-key
   ```

### Option C: Self-Host mem0

```bash
# Clone mem0
git clone https://github.com/mem0ai/mem0.git
cd mem0

# Run with Docker
docker-compose up -d

# Add to .env.local
MEM0_SELF_HOSTED_URL=http://localhost:8080
MEM0_API_KEY=your-local-key
```

---

## Step 5: Local Development Testing

### 5.1 Install Dependencies

```bash
npm install
```

### 5.2 Start Development Server

```bash
npm run dev
```

### 5.3 Test the New Endpoint

```bash
# Health check
curl http://localhost:3000/api/v2/chat/completions

# Chat completion (use your actual API key)
curl http://localhost:3000/api/v2/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-soulprint-demo-fallback-123456" \
  -d '{
    "messages": [{"role": "user", "content": "Hey, how are you?"}],
    "stream": false
  }'
```

### 5.4 Test Streaming

```bash
curl http://localhost:3000/api/v2/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-soulprint-demo-fallback-123456" \
  -d '{
    "messages": [{"role": "user", "content": "Tell me a story"}],
    "stream": true
  }'
```

---

## Step 6: Update Frontend to Use v2 API

### 6.1 Update Chat Client

In `app/dashboard/chat/chat-client.tsx`, change the API endpoint:

```typescript
// Old
const response = await fetch('/api/gemini/chat', {...})

// New
const response = await fetch('/api/v2/chat/completions', {...})
```

### 6.2 Handle Training Example IDs

To improve fine-tuning data quality, track continuation:

```typescript
const [lastExampleId, setLastExampleId] = useState<string | null>(null);

// When sending message
const response = await fetch('/api/v2/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    messages,
    previous_example_id: lastExampleId, // Marks continuation
  }),
});

const data = await response.json();
setLastExampleId(data.soulprint_meta?.training_example_id);
```

---

## Step 7: Cost Optimization (Optional)

### 7.1 Auto-Shutdown Script

Create a Lambda to stop the instance during off-hours:

```python
# infrastructure/aws/lambda_stop.py
import boto3

def lambda_handler(event, context):
    ec2 = boto3.client('ec2', region_name='us-east-1')
    ec2.stop_instances(InstanceIds=['i-xxxxxxxxx'])
    return 'Stopped'
```

### 7.2 Spot Instances (Advanced)

For ~70% cost savings, use Spot Instances. Note: may be interrupted.

Update `main.tf`:
```hcl
resource "aws_spot_instance_request" "llm_server" {
  ami                    = data.aws_ami.deep_learning.id
  instance_type          = "g5.48xlarge"
  spot_price             = "12.00"  # Max price per hour
  wait_for_fulfillment   = true
  # ... rest of config
}
```

---

## Step 8: Monitoring

### 8.1 CloudWatch Metrics

Monitor in AWS Console:
- GPU utilization
- Memory usage
- Request latency
- Error rates

### 8.2 Application Metrics

The `/api/v2/chat/completions` GET endpoint returns health status:

```bash
curl http://localhost:3000/api/v2/chat/completions
# Returns: {"status": "healthy", "components": {...}}
```

---

## Step 9: Fine-Tuning Export (Future)

When you have enough data, export for fine-tuning:

```bash
# Create export script
node -e "
const { exportTrainingData } = require('./lib/finetuning/collector');
exportTrainingData({
  format: 'sharegpt',
  minQuality: 70,
  maxExamples: 10000
}).then(data => {
  require('fs').writeFileSync('training_data.jsonl', data);
  console.log('Exported!');
});
"
```

---

## Troubleshooting

### vLLM Won't Start

```bash
# Check GPU availability
nvidia-smi

# Check vLLM logs
sudo journalctl -u vllm -n 100

# Common issue: Out of GPU memory
# Solution: Reduce max_model_len in setup.sh
```

### Slow Response Times

1. Check if model is loaded: `curl http://<endpoint>/health`
2. First request after cold start is slow (model loading)
3. Consider using smaller model (Qwen 2.5 32B) for faster inference

### Memory Errors

```bash
# Check memory usage
free -h

# If running out of RAM, increase swap
sudo fallocate -l 64G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Database Migration Fails

Check Supabase logs in Dashboard > Logs > Postgres

Common issues:
- Missing `auth.users` table reference (ensure auth is set up)
- Vector extension not enabled (run `CREATE EXTENSION IF NOT EXISTS vector;`)

---

## Next Steps

1. [ ] Deploy AWS infrastructure
2. [ ] Run database migration
3. [ ] Test v2 API locally
4. [ ] Update frontend to use v2 API
5. [ ] Monitor and iterate
6. [ ] Collect training data
7. [ ] Fine-tune your own SoulPrint model

---

## Architecture Summary

```
User → Next.js Frontend
         ↓
    /api/v2/chat/completions
         ↓
    ┌────────────────────────────────────┐
    │         Compete Orchestrator       │
    │                                    │
    │  1. Load memories (mem0/Supabase) │
    │  2. Analyze personality (Big Five)│
    │  3. Detect emotion                │
    │  4. Build dynamic prompt          │
    │  5. Call AWS vLLM                 │
    │  6. Extract new memories          │
    │  7. Log for fine-tuning          │
    └────────────────────────────────────┘
         ↓
    AWS g5.48xlarge
    vLLM + Qwen 2.5 72B
         ↓
    Response → User
```

---

*Guide created: January 2026*
*For SoulPrint Compete Stack v1.0*
