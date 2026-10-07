FROM node:20-slim

WORKDIR /app
COPY . .

RUN npm install --omit=dev || npm install

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "while true; do node server.js; echo 'restarting...'; sleep 2; done"]
