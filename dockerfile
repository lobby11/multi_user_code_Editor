
FROM node:20-alpine as frontend-builder
COPY ./frontend /app
WORKDIR /app
RUN npm install
RUN npm run build

# -- backend build
FROM node:20-alpine AS backend-builder
COPY ./backend /app
WORKDIR /app
RUN npm install

COPY --from=frontend-builder /app/dist /app/public
EXPOSE 3000
CMD ["npm", "start"]
# CMD ["node","server.js"]
