FROM node:20-alpine

# Set working directory inside container
WORKDIR /usr/src/app

# Copy dependency definitions
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application source files
COPY . .

# Expose Node app internal port
EXPOSE 5000

# Start server
CMD ["node", "server.js"]
