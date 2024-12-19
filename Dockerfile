# Use the official Node.js image as the base image for building the application.
FROM node:21-alpine3.18 as builder

# Enable Corepack and prepare for PNPM installation
RUN corepack enable && corepack prepare pnpm@latest --activate
ENV PNPM_HOME=/usr/local/bin

# Set the working directory inside the container
WORKDIR /app

# Copy package.json files to the working directory
COPY package*.json ./

# Install git for potential dependencies
RUN apk add --no-cache git

# Install PM2 globally using PNPM
RUN pnpm install pm2 -g

# Copy the application source code into the container
COPY . .

# Install dependencies using PNPM
RUN pnpm install

# Build the TypeScript application
RUN pnpm run build

# Move app.js from dist to src and delete app.ts
RUN mv dist/app.js src/app.js && rm src/app.ts

# Create a new stage for deployment
FROM builder as deploy

# Set the working directory inside the container
WORKDIR /app

# Expose the necessary port
ARG PORT
ENV PORT=$PORT
EXPOSE $PORT

# Copy only necessary files and directories for deployment
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./

# Install production dependencies using frozen lock file
RUN pnpm install --frozen-lockfile --production

# Define the command to start the application using PM2 runtime with a cron pattern
CMD ["pm2-runtime", "start", "./src/app.js", "--cron", "0 4 * * *"]
