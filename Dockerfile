FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
COPY SYSTEM_INSTRUCTION_360_RELANCE.txt ./SYSTEM_INSTRUCTION_360_RELANCE.txt
ENV NODE_ENV=production
ENV PORT=8080
USER node
CMD ["node", "src/server.mjs"]
