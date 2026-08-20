FROM python:3.11-slim

# Install Java (required for Apache Spark)
RUN apt-get update && \
    apt-get install -y default-jre procps && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements
COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the API and Backend directories
COPY api/ ./api/
COPY backend/ ./backend/

# Set working directory to API for uvicorn
WORKDIR /app/api

EXPOSE 8000

# Default command
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
