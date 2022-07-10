FROM node:18-alpine

RUN npm install -g pnpm typescript

WORKDIR /app

COPY package*.json ./

RUN pnpm install

COPY . .

RUN tsc

EXPOSE 8000

CMD ["pnpm", "start"]