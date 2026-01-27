FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir git+https://github.com/alexzhang13/rlm.git

# Copy app
COPY main.py .

# Expose port
EXPOSE 8100

# Run
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8100"]
