# Use a lightweight python image
FROM python:3.11-slim

# Set environment variables to optimize Python running inside Docker
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set work directory
WORKDIR /app

# Install system dependencies (helpful for packages compiling native extensions)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend source code
COPY . /app/

# Expose the Flask port (5001)
EXPOSE 5001

# Run the app with Gunicorn. 
# We use 1 worker and a long timeout (120s) because TensorFlow + loading models is CPU and RAM heavy at boot.
CMD ["gunicorn", "--bind", "0.0.0.0:5001", "--workers", "1", "--timeout", "120", "app:app"]
