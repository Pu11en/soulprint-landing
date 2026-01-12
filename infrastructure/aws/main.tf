# SoulPrint LLM Infrastructure - Terraform Configuration
# Deploys g5.48xlarge with vLLM for Qwen 2.5 72B

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Variables
variable "aws_region" {
  default = "us-east-1"
}

variable "instance_type" {
  default = "g5.48xlarge"  # 8x A10G, 192GB VRAM
}

variable "hf_token" {
  description = "HuggingFace token for model download"
  sensitive   = true
}

# VPC
resource "aws_vpc" "soulprint_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "soulprint-llm-vpc"
  }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.soulprint_vpc.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = {
    Name = "soulprint-public-subnet"
  }
}

resource "aws_subnet" "private" {
  vpc_id            = aws_vpc.soulprint_vpc.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "${var.aws_region}a"

  tags = {
    Name = "soulprint-private-subnet"
  }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.soulprint_vpc.id

  tags = {
    Name = "soulprint-igw"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.soulprint_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = {
    Name = "soulprint-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# Security Groups
resource "aws_security_group" "alb_sg" {
  name        = "soulprint-alb-sg"
  description = "Security group for ALB"
  vpc_id      = aws_vpc.soulprint_vpc.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "soulprint-alb-sg"
  }
}

resource "aws_security_group" "llm_sg" {
  name        = "soulprint-llm-sg"
  description = "Security group for LLM instance"
  vpc_id      = aws_vpc.soulprint_vpc.id

  # Allow traffic from ALB only
  ingress {
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  # SSH for management (restrict to your IP in production)
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # Restrict this!
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "soulprint-llm-sg"
  }
}

# IAM Role for EC2
resource "aws_iam_role" "llm_role" {
  name = "soulprint-llm-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_instance_profile" "llm_profile" {
  name = "soulprint-llm-profile"
  role = aws_iam_role.llm_role.name
}

# Deep Learning AMI (Ubuntu 22.04)
data "aws_ami" "deep_learning" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["Deep Learning Base OSS Nvidia Driver GPU AMI (Ubuntu 22.04)*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# EC2 Instance
resource "aws_instance" "llm_server" {
  ami                    = data.aws_ami.deep_learning.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.llm_sg.id]
  iam_instance_profile   = aws_iam_instance_profile.llm_profile.name

  root_block_device {
    volume_size = 500
    volume_type = "gp3"
    iops        = 16000
    throughput  = 1000
  }

  user_data = templatefile("${path.module}/setup.sh", {
    hf_token = var.hf_token
  })

  tags = {
    Name = "soulprint-llm-inference"
  }

  # Wait for instance to be ready
  lifecycle {
    create_before_destroy = true
  }
}

# Application Load Balancer
resource "aws_lb" "llm_alb" {
  name               = "soulprint-llm-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = [aws_subnet.public.id]

  tags = {
    Name = "soulprint-llm-alb"
  }
}

resource "aws_lb_target_group" "llm_tg" {
  name     = "soulprint-llm-tg"
  port     = 8000
  protocol = "HTTP"
  vpc_id   = aws_vpc.soulprint_vpc.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 10
    unhealthy_threshold = 3
  }
}

resource "aws_lb_target_group_attachment" "llm_attachment" {
  target_group_arn = aws_lb_target_group.llm_tg.arn
  target_id        = aws_instance.llm_server.id
  port             = 8000
}

# HTTPS Listener (requires ACM certificate)
# For now, using HTTP - add certificate for production
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.llm_alb.arn
  port              = "443"
  protocol          = "HTTP"  # Change to HTTPS with certificate

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.llm_tg.arn
  }
}

# Outputs
output "alb_dns_name" {
  value       = aws_lb.llm_alb.dns_name
  description = "DNS name of the ALB - use this as AWS_LLM_ENDPOINT"
}

output "instance_id" {
  value       = aws_instance.llm_server.id
  description = "EC2 instance ID"
}

output "instance_public_ip" {
  value       = aws_instance.llm_server.public_ip
  description = "Public IP for SSH access"
}
