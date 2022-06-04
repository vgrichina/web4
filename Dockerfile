FROM node:16

RUN apt-get update && apt-get install -y git

EXPOSE 80

RUN yarn

CMD [ "yarn", "start" ]
