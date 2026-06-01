FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY packages/core/package.json packages/core/
COPY packages/adapters/package.json packages/adapters/
COPY packages/server/package.json packages/server/
RUN npm install --workspace=@agent-office/server
COPY packages/core packages/core
COPY packages/adapters packages/adapters
COPY packages/server packages/server
RUN npm run build --workspace=@agent-office/core
RUN npm run build --workspace=@agent-office/adapters
RUN npm run build --workspace=@agent-office/server

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/packages/adapters/dist ./packages/adapters/dist
COPY --from=builder /app/packages/adapters/package.json ./packages/adapters/
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/package.json ./packages/server/
EXPOSE 3000
CMD ["node", "packages/server/dist/index.js"]
