FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
ARG REPO_URL=https://github.com/delux1000/80-websites.git
ARG REPO_BRANCH=main
WORKDIR /app
RUN git clone --depth 1 --branch ${REPO_BRANCH} ${REPO_URL} .
RUN npm install --omit=dev || npm install
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["sh", "-c", "while true; do node server.js; echo 'restarting...'; sleep 2; done"]
