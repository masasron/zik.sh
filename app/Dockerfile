FROM node:17.0.1-alpine3.14
EXPOSE 3001

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json /usr/src/app/
RUN npm install

# Add a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Set ownership and permissions for the app directory
RUN chown -R appuser:appgroup /usr/src/app
RUN chmod -R 755 /usr/src/app

# Bundle app source
COPY . /usr/src/app

# Build the app
RUN npm run build

# Set the user
USER appuser

# Start the app
CMD [ "npm", "start" ]
