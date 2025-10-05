# Simple Development Dockerfile for Next.js
FROM node:20

WORKDIR /app

# Copy package.json and install dependencies (ignore lock file)
COPY package.json ./
RUN rm -f package-lock.json && \
    npm cache clean --force && \
    npm install --prefer-online

# Copy all source code
COPY . .

# Set environment variables for Docker networking
ENV HOSTNAME=0.0.0.0
ENV PORT=3777

# Expose port
EXPOSE 3777

# Default command (can be overridden by compose)
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3777"]
