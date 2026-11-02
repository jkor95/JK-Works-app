FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force
COPY src ./src
USER node
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["node", "src/server.mjs"]
