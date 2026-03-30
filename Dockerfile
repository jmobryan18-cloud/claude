FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY server/package*.json ./server/
RUN cd server && npm ci

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/server/node_modules ./server/node_modules
COPY server/ ./server/
COPY public/ ./public/
RUN mkdir -p /data/photos
EXPOSE 3000
ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV PHOTOS_DIR=/data/photos
CMD ["node", "server/index.js"]
