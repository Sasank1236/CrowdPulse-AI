FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY --chown=node:node . .

USER node

EXPOSE 5000
ENV PORT=5000

CMD ["node", "Server.js"]
