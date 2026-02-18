FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

ENV PORT 9999
EXPOSE 9999

# The command to start the chaincode as a service
CMD ["node", "dist/index.js"]
