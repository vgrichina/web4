FROM node:16

RUN sudo apt install nginx

EXPOSE 80

RUN yarn

CMD [ "yarn", "start" ]
