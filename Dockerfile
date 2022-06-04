FROM node:16

RUN apt-get update && apt-get install -y nginx

WORKDIR /usr/src/app

COPY . .

RUN yarn

EXPOSE 80

CMD [ "node", "app" ]
