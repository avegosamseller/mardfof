FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY packages/ui/package.json packages/ui/
RUN npm install --workspace=@agent-office/ui
COPY packages/ui packages/ui
RUN npm run build --workspace=@agent-office/ui

FROM nginx:alpine
COPY --from=builder /app/packages/ui/dist /usr/share/nginx/html
COPY packages/ui/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
