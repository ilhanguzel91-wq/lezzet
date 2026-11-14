# Lezzet Rotası API — Google Cloud Run image
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY public ./public
USER node
# Cloud Run provides PORT (8080)
ENV PORT=8080
EXPOSE 8080
CMD ["node", "src/index.js"]
