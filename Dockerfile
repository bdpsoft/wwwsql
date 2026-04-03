# Stage 1: Build
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
# Instaliramo sve zavisnosti
RUN npm install

# Kopiramo ostatak koda i (opciono) radimo build ako koristiš TS ili React
COPY . .

# Stage 2: Production
FROM node:20-slim
WORKDIR /app
# Kopiramo samo node_modules i kod iz builder-a da smanjimo veličinu imidža
COPY --from=builder /app /app

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server.js"]