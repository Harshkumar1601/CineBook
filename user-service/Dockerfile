# Dockerfile for each Node.js service (same template, placed in each service folder)
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE $PORT
CMD ["node", "src/server.js"]
