FROM mcr.microsoft.com/playwright:v1.58.0-noble
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server.mjs ./
USER pwuser
EXPOSE 8080
CMD ["node","server.mjs"]
