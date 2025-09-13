// ws-server/index.js
const WebSocket = require("ws");
const Redis = require("ioredis");
require("dotenv").config();

const redisSub = new Redis(process.env.REDIS_URL);

// Start WebSocket server
const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

wss.on("connection", (ws) => {
  ws.send(
    JSON.stringify({ type: "welcome", msg: "Connected to orders updates" })
  );
});

// Subscribe to Redis channel
redisSub.subscribe("orders_updates");
redisSub.on("message", (_, message) => {
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
  console.log("Forwarded to WebSocket clients:", message);
});
