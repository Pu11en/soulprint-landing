# SoulPrint AWS Always-On Infrastructure

## PROJECT CONTEXT

**Goal**: Deploy a self-hosted LLM (Qwen 2.5 72B) on AWS that is always available with zero fallbacks. No Gemini, no OpenAI - AWS is the only path.

**Constraint**: If AWS is down, the app is down. This means we need bulletproof infrastructure.

**Stack**:
- AWS g5.48xlarge (8x A10G, 192GB VRAM)
- vLLM inference server
- Qwen 2.5 72B Instruct model
- Application Load Balancer
- Auto-recovery on failure

---

## HIGH AVAILABILITY ARCHITECTURE

```
                    ┌─────────────────────────────────────┐
                    │           Route 53 DNS              │
                    │      llm.soulprint.ai               │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │     Application Load Balancer       │
                    │     - Health checks every 10s       │
                    │     - SSL termination               │
                    │     - Request routing               │
                    └─────────────────┬───────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
    ┌─────────▼─────────┐   ┌────────▼────────┐   ┌─────────▼─────────┐
    │   g5.48xlarge     │   │  g5.48xlarge    │   │   (Standby)       │
    │   Primary         │   │  Secondary      │   │   Cold spare      │
    │   us-east-1a      │   │  us-east-1b     │   │   us-east-1c      │
    │                   │   │                 │   │                   │
    │   vLLM + Qwen72B  │   │  vLLM + Qwen72B │   │   AMI ready       │
    └───────────────────┘   └─────────────────┘   └───────────────────┘
```

---

## WHAT MAKES IT ALWAYS-ON

### 1. Multi-Instance Setup
- **Primary**: Always running, handles traffic
- **Secondary**: Hot standby, can take over in <30 seconds
- **Cold Spare**: AMI ready to launch if both fail

### 2. Auto-Recovery
- CloudWatch monitors instance health
- Auto-recovery action on system failure
- Instance replaced automatically

### 3. Health Checks
- ALB checks `/health` every 10 seconds
- 2 consecutive failures = mark unhealthy
- Traffic routes away from unhealthy instances

### 4. Auto-Scaling (Optional)
- Scale up during high load
- Maintain minimum 1 healthy instance always

### 5. Model Pre-Loading
- Model cached on EBS (gp3 500GB)
- Startup time: ~5 min (vs 45 min fresh download)
- Warm instances keep model in GPU memory

---

## COST BREAKDOWN

| Component | Monthly Cost | Notes |
|-----------|--------------|-------|
| g5.48xlarge Primary | $11,700 | Always on |
| g5.48xlarge Secondary | $11,700 | Hot standby (optional) |
| ALB | ~$50 | Load balancer |
| EBS Storage (500GB x2) | ~$100 | Model cache |
| Data Transfer | ~$200 | Varies with usage |
| **Single Instance** | **~$12,000/mo** | |
| **HA (2 instances)** | **~$24,000/mo** | |

### Cost Optimization Options
1. **Spot + On-Demand Mix**: Secondary as spot (~70% savings on secondary)
2. **Reserved Instances**: 1-year commitment = 40% off
3. **Scheduled Scaling**: Reduce to 1 instance during off-hours

---

## TERRAFORM CONFIGURATION

### Main Infrastructure (`main.tf`)

```hcl
provider "aws" {
  region = "us-east-1"
}

# VPC
resource "aws_vpc" "soulprint" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "soulprint-llm-vpc"
  }
}

# Subnets in multiple AZs
resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.soulprint.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "us-east-1a"
  map_public_ip_on_launch = true

  tags = {
    Name = "soulprint-public-a"
  }
}

resource "aws_subnet" "public_b" {
  vpc_id                  = aws_vpc.soulprint.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "us-east-1b"
  map_public_ip_on_launch = true

  tags = {
    Name = "soulprint-public-b"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.soulprint.id
}

# Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.soulprint.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
}

resource "aws_route_table_association" "public_a" {
  subnet_id      = aws_subnet.public_a.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_b" {
  subnet_id      = aws_subnet.public_b.id
  route_table_id = aws_route_table.public.id
}

# Security Group
resource "aws_security_group" "llm_server" {
  name        = "soulprint-llm-sg"
  description = "Security group for LLM inference server"
  vpc_id      = aws_vpc.soulprint.id

  # vLLM API from ALB only
  ingress {
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # SSH for management
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.admin_ip]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "alb" {
  name        = "soulprint-alb-sg"
  description = "Security group for ALB"
  vpc_id      = aws_vpc.soulprint.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Deep Learning AMI
data "aws_ami" "deep_learning" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["Deep Learning AMI GPU PyTorch * (Ubuntu 22.04) *"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

# Launch Template
resource "aws_launch_template" "llm_server" {
  name_prefix   = "soulprint-llm-"
  image_id      = data.aws_ami.deep_learning.id
  instance_type = "g5.48xlarge"

  vpc_security_group_ids = [aws_security_group.llm_server.id]

  block_device_mappings {
    device_name = "/dev/sda1"
    ebs {
      volume_size           = 500
      volume_type           = "gp3"
      iops                  = 16000
      throughput            = 1000
      delete_on_termination = false  # Keep model cache
      encrypted             = true
    }
  }

  user_data = base64encode(templatefile("setup.sh", {
    hf_token = var.hf_token
  }))

  monitoring {
    enabled = true
  }

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "soulprint-llm-server"
    }
  }
}

# Auto Scaling Group
resource "aws_autoscaling_group" "llm_servers" {
  name                = "soulprint-llm-asg"
  vpc_zone_identifier = [aws_subnet.public_a.id, aws_subnet.public_b.id]
  target_group_arns   = [aws_lb_target_group.llm.arn]

  min_size         = 1  # Always at least 1
  max_size         = 2  # Can scale to 2 for HA
  desired_capacity = 1  # Start with 1

  launch_template {
    id      = aws_launch_template.llm_server.id
    version = "$Latest"
  }

  health_check_type         = "ELB"
  health_check_grace_period = 600  # 10 min for model loading

  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 50
    }
  }

  tag {
    key                 = "Name"
    value               = "soulprint-llm-server"
    propagate_at_launch = true
  }
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "soulprint-llm-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_b.id]

  enable_deletion_protection = true
}

resource "aws_lb_target_group" "llm" {
  name     = "soulprint-llm-tg"
  port     = 8000
  protocol = "HTTP"
  vpc_id   = aws_vpc.soulprint.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 10
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  deregistration_delay = 30
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.ssl_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.llm.arn
  }
}

resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "unhealthy_hosts" {
  alarm_name          = "soulprint-llm-unhealthy-hosts"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Average"
  threshold           = 0
  alarm_description   = "LLM server unhealthy"

  dimensions = {
    TargetGroup  = aws_lb_target_group.llm.arn_suffix
    LoadBalancer = aws_lb.main.arn_suffix
  }

  alarm_actions = [var.sns_topic_arn]
}

resource "aws_cloudwatch_metric_alarm" "high_latency" {
  alarm_name          = "soulprint-llm-high-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Average"
  threshold           = 30  # 30 seconds
  alarm_description   = "LLM response time too high"

  dimensions = {
    TargetGroup  = aws_lb_target_group.llm.arn_suffix
    LoadBalancer = aws_lb.main.arn_suffix
  }

  alarm_actions = [var.sns_topic_arn]
}

# Route 53 (Optional - if you have a domain)
resource "aws_route53_record" "llm" {
  count   = var.create_dns_record ? 1 : 0
  zone_id = var.route53_zone_id
  name    = "llm.soulprint.ai"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# Outputs
output "alb_dns_name" {
  value       = aws_lb.main.dns_name
  description = "ALB DNS name - use this as AWS_LLM_ENDPOINT"
}

output "vpc_id" {
  value = aws_vpc.soulprint.id
}
```

### Variables (`variables.tf`)

```hcl
variable "hf_token" {
  description = "HuggingFace API token for model download"
  type        = string
  sensitive   = true
}

variable "admin_ip" {
  description = "Your IP for SSH access (e.g., 1.2.3.4/32)"
  type        = string
  default     = "0.0.0.0/0"  # Restrict this in production
}

variable "ssl_certificate_arn" {
  description = "ACM certificate ARN for HTTPS"
  type        = string
}

variable "sns_topic_arn" {
  description = "SNS topic for alerts"
  type        = string
  default     = ""
}

variable "create_dns_record" {
  description = "Whether to create Route 53 record"
  type        = bool
  default     = false
}

variable "route53_zone_id" {
  description = "Route 53 hosted zone ID"
  type        = string
  default     = ""
}
```

### Setup Script (`setup.sh`)

```bash
#!/bin/bash
set -e

# Log everything
exec > >(tee /var/log/soulprint-setup.log) 2>&1

echo "=== SoulPrint LLM Server Setup ==="
echo "Started at: $(date)"

# Install dependencies
apt-get update
apt-get install -y python3-pip nginx

# Install vLLM
pip3 install vllm ray

# Login to HuggingFace
echo "${hf_token}" | huggingface-cli login --token

# Create systemd service for vLLM
cat > /etc/systemd/system/vllm.service << 'VLLM_SERVICE'
[Unit]
Description=vLLM Inference Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu
Environment="HF_HOME=/home/ubuntu/.cache/huggingface"
ExecStart=/usr/local/bin/python3 -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen2.5-72B-Instruct \
    --tensor-parallel-size 8 \
    --host 0.0.0.0 \
    --port 8000 \
    --max-model-len 32768 \
    --gpu-memory-utilization 0.95 \
    --enable-chunked-prefill \
    --max-num-batched-tokens 32768

Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
VLLM_SERVICE

# Enable and start vLLM
systemctl daemon-reload
systemctl enable vllm
systemctl start vllm

echo "=== Setup Complete ==="
echo "vLLM will download model on first start (~45 min)"
echo "Check status with: systemctl status vllm"
echo "Check logs with: journalctl -u vllm -f"
```

---

## UPDATED CLIENT (NO FALLBACKS)

Replace `lib/aws/vllm-client.ts` with this version that has NO fallbacks:

```typescript
/**
 * AWS vLLM Client - NO FALLBACKS
 *
 * This client ONLY calls AWS vLLM. If it's down, requests fail.
 * This is intentional - we want to know immediately if AWS has issues.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
}

const AWS_LLM_ENDPOINT = process.env.AWS_LLM_ENDPOINT;
const AWS_LLM_API_KEY = process.env.AWS_LLM_API_KEY;
const AWS_LLM_MODEL = process.env.AWS_LLM_MODEL || 'Qwen/Qwen2.5-72B-Instruct';

if (!AWS_LLM_ENDPOINT) {
  throw new Error('AWS_LLM_ENDPOINT is required - no fallbacks configured');
}

/**
 * Health check - throws if unhealthy
 */
export async function checkHealth(): Promise<true> {
  const response = await fetch(`${AWS_LLM_ENDPOINT}/health`, {
    method: 'GET',
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`AWS vLLM unhealthy: ${response.status}`);
  }

  return true;
}

/**
 * Chat completion - NO FALLBACKS
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<string> {
  const {
    temperature = 0.7,
    max_tokens = 2048,
    top_p = 0.9,
  } = options;

  const response = await fetch(`${AWS_LLM_ENDPOINT}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(AWS_LLM_API_KEY && { 'Authorization': `Bearer ${AWS_LLM_API_KEY}` }),
    },
    body: JSON.stringify({
      model: AWS_LLM_MODEL,
      messages,
      temperature,
      max_tokens,
      top_p,
      stream: false,
    }),
    signal: AbortSignal.timeout(120000), // 2 minute timeout
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AWS vLLM error ${response.status}: ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Streaming chat completion - NO FALLBACKS
 */
export async function* streamChatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): AsyncGenerator<string, void, unknown> {
  const {
    temperature = 0.7,
    max_tokens = 2048,
    top_p = 0.9,
  } = options;

  const response = await fetch(`${AWS_LLM_ENDPOINT}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(AWS_LLM_API_KEY && { 'Authorization': `Bearer ${AWS_LLM_API_KEY}` }),
    },
    body: JSON.stringify({
      model: AWS_LLM_MODEL,
      messages,
      temperature,
      max_tokens,
      top_p,
      stream: true,
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AWS vLLM error ${response.status}: ${error}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }
}
```

---

## UPDATED ORCHESTRATOR (NO FALLBACKS)

Update `lib/compete/orchestrator.ts` - remove all Gemini/OpenAI fallback code:

```typescript
// In competeChatCompletion function, replace the LLM call section:

// 8. Call LLM - AWS ONLY, NO FALLBACKS
const response = await awsChatCompletion(fullMessages, {
  temperature: 0.8,
  max_tokens: 2048,
});
const modelUsed = process.env.AWS_LLM_MODEL || 'Qwen/Qwen2.5-72B-Instruct';

// Remove all try/catch fallback logic
```

---

## DEPLOYMENT CHECKLIST

### Before Deployment
- [ ] AWS account with g5.48xlarge quota (request increase if needed)
- [ ] HuggingFace token with Qwen access
- [ ] ACM SSL certificate for your domain
- [ ] Terraform installed locally

### Deployment Steps
1. [ ] `cd infrastructure/aws`
2. [ ] Create `terraform.tfvars` with your values
3. [ ] `terraform init`
4. [ ] `terraform plan` - review
5. [ ] `terraform apply` - deploy
6. [ ] Wait 45 min for model download
7. [ ] Test health endpoint
8. [ ] Update `.env.local` with ALB DNS
9. [ ] Test chat completion
10. [ ] Deploy to Vercel with new env vars

### Post-Deployment
- [ ] Set up CloudWatch dashboard
- [ ] Configure SNS alerts to your phone/email
- [ ] Test auto-recovery by stopping instance manually
- [ ] Document the endpoint URL

---

## MONITORING & ALERTS

### CloudWatch Dashboard Widgets
1. **Healthy Host Count** - Should always be >= 1
2. **Target Response Time** - Should be < 30s
3. **Request Count** - Traffic patterns
4. **GPU Utilization** - Should be < 95%
5. **Memory Utilization** - Should be < 90%

### Alert Conditions
| Metric | Threshold | Action |
|--------|-----------|--------|
| Unhealthy hosts > 0 | Immediate | Page on-call |
| Response time > 30s | 3 min | Warning |
| Response time > 60s | 1 min | Page on-call |
| 5xx errors > 10/min | 2 min | Page on-call |
| GPU util > 95% | 5 min | Scale up |

---

## RECOVERY PROCEDURES

### Instance Won't Start
1. Check CloudWatch logs
2. Check instance system logs in EC2 console
3. Try stopping and starting instance
4. If EBS corrupted, launch new instance from AMI

### Model Won't Load
1. SSH into instance
2. Check vLLM logs: `journalctl -u vllm -f`
3. Check disk space: `df -h`
4. Re-download model: `rm -rf ~/.cache/huggingface && systemctl restart vllm`

### High Latency
1. Check GPU utilization: `nvidia-smi`
2. Check if batching is working
3. Consider scaling to 2 instances
4. Check for memory leaks

---

## COST OPTIMIZATION (LATER)

Once stable, consider:

1. **Reserved Instances** - 1yr commitment = 40% off
2. **Savings Plans** - Flexible commitment = 30% off
3. **Spot for Secondary** - Hot standby as spot = 70% off secondary
4. **Scheduled Scaling** - 1 instance nights/weekends

---

*Spec ready for VS Code + Claude Code + GSD execution*
