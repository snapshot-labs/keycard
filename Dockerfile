FROM node:18-alpine

WORKDIR /app

COPY package.json ./
COPY yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

ENV PORT=3002

EXPOSE 3002

CMD ["yarn", "run", "dev"]
