FROM node:16-bullseye
WORKDIR /app
COPY . /app
RUN npm install --production
CMD ["node", "index.js"]
