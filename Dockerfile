FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm config set registry https://package-mirror.liara.ir/repository/npm/ --global

RUN npm ci || \
    (echo "=== Runflare mirror failed, falling back to npmjs ===" && \
     npm config set registry https://registry.npmjs.org/ && \
     npm ci)

COPY . .

RUN npm run build

RUN npm prune --production

EXPOSE 3101

CMD ["node", "dist/server.js"]