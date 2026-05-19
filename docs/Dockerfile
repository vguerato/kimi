# ─── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Instala dependências
COPY package.json ./
RUN npm install

# Copia o restante e faz o build estático
COPY . .
RUN npm run build

# ─── Stage 2: serve ──────────────────────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/build /usr/share/nginx/html

# Configuração Nginx para SPA (redireciona 404 para index.html)
RUN printf 'server {\n\
    listen 3002;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 3002
