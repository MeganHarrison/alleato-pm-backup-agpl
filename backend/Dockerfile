FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    default-jre-headless \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY entrypoint.py ./entrypoint.py

# Create directories for scripts and workers if needed
RUN mkdir -p src/workers/scripts && chmod +x entrypoint.py

# Set Python path to include src directories (including YokeFlow)
ENV PYTHONPATH=/app:/app/src:/app/src/services:/app/src/workers:/app/src/yokeflow

# Set Python to run in unbuffered mode for better logging
ENV PYTHONUNBUFFERED=1

# Expose port (use PORT env var for Render compatibility)
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Run the application with dynamic port binding
CMD ["python3", "entrypoint.py"]
