// redis-sub.js
require("dotenv").config();
const Redis = require("ioredis");
const redis = new Redis(process.env.REDIS_URL);

const channel = "orders_updates";
redis.subscribe(channel, (err, count) => {
  if (err) {
    console.error("subscribe error", err);
    process.exit(1);
  }
  console.log(`Subscribed to ${channel} (${count} channels)`);
});

redis.on("message", (chan, message) => {
  console.log("REDIS MESSAGE:", chan, message);
});
