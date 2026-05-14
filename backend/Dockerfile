FROM node:20

# Install git since the agent needs to run git commands
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN git config --global --add safe.directory '*'

WORKDIR /app

COPY package*.json ./
RUN npm install
RUN npm rebuild sqlite3 --build-from-source

COPY . .

# Build typescript if we have a build script, otherwise we can just use ts-node for now
# We will use ts-node for simplicity, or we can compile it.
# Let's compile it for production
RUN npx tsc

EXPOSE 3001

CMD ["node", "dist/index.js"]
