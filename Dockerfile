FROM node:16-bullseye
WORKDIR /app
COPY . /app
RUN apt-get update -y && apt-get install -y ffmpeg
RUN npm install --production
CMD ["node", "index.js"]
