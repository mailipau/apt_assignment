// publisher/index.js
require("dotenv").config();
const { Client } = require("pg");
const Redis = require("ioredis");

const PG_CONN = process.env.DATABASE_URL;
const REDIS_CONN = process.env.REDIS_URL;
if (!PG_CONN || !REDIS_CONN) {
  console.error("Missing DATABASE_URL or REDIS_URL in environment. Exiting.");
  process.exit(1);
}

let running = true;
let backoffMs = 1000; // reconnect backoff start

function wait(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function startPublisher() {
  while (running) {
    const pgClient = new Client({ connectionString: PG_CONN });
    const redis = new Redis(REDIS_CONN);

    try {
      console.log("[pg] connecting...");
      await pgClient.connect();
      console.log("[pg] connected");

      // Optional simple check to ensure DB is alive
      await pgClient.query("SELECT 1");

      console.log("[redis] connecting...");
      // ioredis connects lazily, but ping to ensure connectivity
      await redis.ping();
      console.log("[redis] connected");

      // Ensure we have a channel name
      const CHANNEL_PG = "orders_channel";
      const CHANNEL_REDIS = "orders_updates";

      // Handle notifications from Postgres (payload is a string)
      await pgClient.query(`LISTEN ${CHANNEL_PG}`);
      console.log(`[pg] LISTEN ${CHANNEL_PG}`);

      // Keep a counter in memory (for local metrics) but use Redis INCR for persistent sequence
      pgClient.on("notification", async (msg) => {
        const raw = msg.payload;
        let payloadObj = null;
        try {
          payloadObj = JSON.parse(raw);
        } catch (err) {
          // payload wasn't JSON (unexpected) — publish raw, but log error
          console.warn(
            "[publisher] Received non-JSON payload, forwarding raw:",
            raw
          );
          payloadObj = { operation: "UNKNOWN", raw };
        }

        try {
          // Add a persistent monotonic id using Redis INCR
          const pubId = await redis.incr("orders:msg_id"); // atomic on Redis server
          payloadObj._pub_id = pubId;
          payloadObj._published_at = new Date().toISOString();
          payloadObj._source = "postgres_notify";

          const out = JSON.stringify(payloadObj);

          // Publish to Redis channel
          const receivers = await redis.publish(CHANNEL_REDIS, out);
          console.log(
            `[publisher] published id=${pubId} receivers=${receivers} op=${
              payloadObj.operation || "N/A"
            }`
          );
        } catch (err) {
          console.error("[publisher] failed to publish to redis", err);
        }
      });

      // Listen for errors and end events and handle gracefully
      pgClient.on("error", (err) => {
        console.error("[pg] client error", err);
      });
      pgClient.on("end", () => {
        console.warn("[pg] client connection ended — will attempt reconnect");
      });

      // Block here until the connections die (or running=false)
      while (running) {
        // Periodically check connections; if either has closed, break to reconnect.
        await wait(2000);
        if (pgClient._ending || pgClient._connected === false) {
          console.warn("[publisher] detected pg client closed");
          break;
        }
        // ioredis: check .status !== 'ready'
        if (redis.status !== "ready") {
          console.warn(
            "[publisher] detected redis not ready (status=" + redis.status + ")"
          );
        }
      }

      // cleanup clients before retrying
      try {
        await pgClient.end();
      } catch (_) {}
      try {
        redis.disconnect();
      } catch (_) {}

      // if running keep trying to reconnect after a small backoff
      if (running) {
        console.log(`[publisher] reconnecting in ${backoffMs}ms...`);
        await wait(backoffMs);
        backoffMs = Math.min(backoffMs * 1.5, 30000); // exponential backoff cap 30s
      } else {
        break;
      }
    } catch (err) {
      console.error("[publisher] startup error:", err);
      try {
        await pgClient.end();
      } catch (_) {}
      try {
        redis.disconnect();
      } catch (_) {}
      console.log(`[publisher] retrying in ${backoffMs}ms...`);
      await wait(backoffMs);
      backoffMs = Math.min(backoffMs * 1.5, 30000);
    }
  } // end while running
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("SIGINT received — shutting down publisher");
  running = false;
});
process.on("SIGTERM", () => {
  console.log("SIGTERM received — shutting down publisher");
  running = false;
});

startPublisher().catch((err) => {
  console.error("Fatal error in publisher", err);
  process.exit(1);
});
