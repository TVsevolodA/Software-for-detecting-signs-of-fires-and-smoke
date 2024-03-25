FROM node

WORKDIR /app

COPY package.json /app/
COPY package-lock.json /app/

RUN npm install

COPY . .

EXPOSE 4000

CMD [ "node", "index.js" ]