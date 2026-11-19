FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --chown=node:node . .
RUN mkdir -p /data && chown node:node /data
USER node
ENV HOST=0.0.0.0 DATA_DIR=/data
CMD ["node", "server.mjs"]
