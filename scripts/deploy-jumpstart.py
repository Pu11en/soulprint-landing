"""
Deploy a JumpStart LLM model to SageMaker.

Usage:
    pip install sagemaker boto3 python-dotenv
    python scripts/deploy-jumpstart.py

This deploys Mistral 7B Instruct - a good balance of quality and cost.
"""

import os
from pathlib import Path

# Load from .env.local
env_file = Path(__file__).parent.parent / '.env.local'
if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key] = value

import boto3
from sagemaker.jumpstart.model import JumpStartModel

# Set region
os.environ.setdefault('AWS_DEFAULT_REGION', os.environ.get('AWS_REGION', 'us-east-1'))

# Available JumpStart LLM models (pick one):
# - "huggingface-llm-mistral-7b-instruct" (Mistral 7B - good quality, fast)
# - "meta-textgeneration-llama-2-7b-f" (Llama 2 7B)
# - "huggingface-llm-falcon-7b-instruct-bf16" (Falcon 7B)

MODEL_ID = "huggingface-llm-mistral-7b-instruct"
ENDPOINT_NAME = "soulprint-llm"
INSTANCE_TYPE = "ml.g5.xlarge"  # ~$1.00/hour

def deploy():
    print(f"Deploying {MODEL_ID}...")
    print(f"Instance: {INSTANCE_TYPE}")
    print(f"Endpoint name: {ENDPOINT_NAME}")
    print()

    # Create JumpStart model
    model = JumpStartModel(
        model_id=MODEL_ID,
        role=os.environ.get('SAGEMAKER_EXECUTION_ROLE_ARN'),
    )

    # Deploy to endpoint
    print("Starting deployment... this takes 10-15 minutes.")
    predictor = model.deploy(
        initial_instance_count=1,
        instance_type=INSTANCE_TYPE,
        endpoint_name=ENDPOINT_NAME,
    )

    print()
    print("=" * 50)
    print("Deployment complete!")
    print(f"Endpoint: {ENDPOINT_NAME}")
    print("=" * 50)

    # Test with a simple prompt
    print()
    print("Testing endpoint...")
    response = predictor.predict({
        "inputs": "Hello! Who are you?",
        "parameters": {
            "max_new_tokens": 100,
            "temperature": 0.7,
        }
    })
    print("Response:", response)

def check_status():
    """Check endpoint status"""
    client = boto3.client('sagemaker')
    try:
        response = client.describe_endpoint(EndpointName=ENDPOINT_NAME)
        status = response['EndpointStatus']
        print(f"Endpoint status: {status}")
        if status == 'Failed':
            print(f"Failure reason: {response.get('FailureReason', 'Unknown')}")
        return status
    except client.exceptions.ClientError as e:
        if 'Could not find' in str(e):
            print("Endpoint not found")
            return 'NotFound'
        raise

def delete():
    """Delete the endpoint to save costs"""
    client = boto3.client('sagemaker')
    try:
        print(f"Deleting endpoint {ENDPOINT_NAME}...")
        client.delete_endpoint(EndpointName=ENDPOINT_NAME)
        print("Endpoint deleted")
    except client.exceptions.ClientError as e:
        print(f"Delete error: {e}")

if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        command = sys.argv[1]
        if command == "status":
            check_status()
        elif command == "delete":
            delete()
        else:
            print(f"Unknown command: {command}")
            print("Usage: python deploy-jumpstart.py [status|delete]")
    else:
        deploy()
