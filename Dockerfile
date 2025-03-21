# Etapa de construcción
FROM node:21-alpine3.18 AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate
ENV PNPM_HOME=/usr/local/bin

COPY . .

RUN mkdir -p src/media
RUN mkdir -p bot_sessions  # Asegúrate de que la carpeta exista

COPY package*.json *-lock.yaml ./

RUN apk add --no-cache --virtual .gyp \
        python3 \
        make \
        g++ \
        pkgconfig \
        graphicsmagick \
        ghostscript \
    && apk add --no-cache git \
    && pnpm install && pnpm run build \
    && apk del .gyp

# Etapa de despliegue
FROM builder AS deploy

WORKDIR /app

# Instalar GraphicsMagick y ghostscript en la etapa de despliegue
RUN apk add --no-cache graphicsmagick ghostscript

# Configurar zona horaria a Buenos Aires
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/America/Argentina/Buenos_Aires /etc/localtime && \
    echo "America/Argentina/Buenos_Aires" > /etc/timezone

# Ya no copiamos bot_sessions desde builder, ya que usaremos un volumen
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/*.json /app/*-lock.yaml ./

RUN corepack enable && corepack prepare pnpm@latest --activate 
ENV PNPM_HOME=/usr/local/bin

RUN npm cache clean --force && pnpm install --production --ignore-scripts \
    && addgroup -g 1001 -S nodejs && adduser -S -u 1001 nodejs \
    && rm -rf $PNPM_HOME/.npm $PNPM_HOME/.node-gyp

# Asegurar permisos para la carpeta bot_sessions
RUN mkdir -p /app/bot_sessions && chown -R nodejs:nodejs /app/bot_sessions

# Instalar PM2 globalmente
RUN pnpm add pm2 -g

# Configurar cron con horario de Buenos Aires
RUN echo "0 3 * * * pm2 restart all" > /etc/crontabs/root

# Copiar el archivo de configuración de PM2
COPY ecosystem.config.cjs .

# Actualizar el CMD
CMD ["sh", "-c", "crond && pm2-runtime start ecosystem.config.cjs"]