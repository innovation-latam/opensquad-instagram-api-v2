# opensquad-instagram-api — serviço HTTP para o Railway.
#
# Base Playwright: traz Node 20 + Chromium + libs de sistema (libnss3, libatk,
# fontes) do render.
# IMPORTANTE: a tag da imagem DEVE bater com a versão do pacote "playwright" no
# package.json (o binário do Chromium é versionado junto do pacote). Ao subir o
# pacote, subir esta tag no mesmo valor.
FROM mcr.microsoft.com/playwright:v1.61.1-noble

WORKDIR /app

# Instala dependências primeiro (cache de camada).
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Copia o código e compila.
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Healthcheck alinhado ao GET /health.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "start"]
