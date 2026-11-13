FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY seed-global-categories.js ./
RUN mkdir -p uploads && chown -R node:node /app
USER node
EXPOSE 5001
CMD ["node", "src/index.js"]
