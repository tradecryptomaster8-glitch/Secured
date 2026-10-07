FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN mkdir -p /app/data
ENV DATA_DIR=/app/data
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
