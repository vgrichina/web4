FROM node:16

RUN apt-get update && apt-get install -y git

WORKDIR /usr/src/app

COPY . ,

RUN yarn

EXPOSE 80

CMD [ "yarn", "start" ]
