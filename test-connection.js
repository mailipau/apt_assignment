// test-connections.js
require("dotenv").config();
const { Client } = require("pg");
const Redis = require("ioredis");

async function test() {
  // Test Postgres
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  const res = await pg.query("SELECT NOW() AS time");
  console.log("✅ Postgres connected, server time:", res.rows[0].time);
  await pg.end();

  // Test Redis
  const redis = new Redis(process.env.REDIS_URL);
  await redis.set("ping", "pong");
  const value = await redis.get("ping");
  console.log("✅ Redis connected, got value:", value);
  redis.disconnect();
}

test().catch((err) => {
  console.error("❌ Connection failed:", err);
});
