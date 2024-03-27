FROM node:18-alpine as nodejs

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package.json .
COPY yarn.lock .

RUN yarn install --frozen-lockfile

# Bundle app source
COPY . .

CMD [ "yarn", "start" ]