// client-demo/cli.js
const WebSocket = require("ws");

const WS_URL = process.env.WS_URL || "ws://localhost:8080";

let attempts = 0;
const MAX_BACKOFF = 30000;

function connect() {
  const delay =
    attempts === 0
      ? 0
      : Math.min(1000 * Math.pow(2, attempts - 1), MAX_BACKOFF);

  setTimeout(() => {
    console.log(
      `${new Date().toISOString()} → connecting to ${WS_URL} (attempt ${
        attempts + 1
      })`
    );
    const ws = new WebSocket(WS_URL);

    ws.on("open", () => {
      attempts = 0;
      console.log("connected");
    });

    ws.on("message", (data) => {
      try {
        const obj = JSON.parse(data.toString());
        console.log("RECV:", obj);
      } catch (e) {
        console.log("RECV (text):", data.toString());
      }
    });

    ws.on("close", (code, reason) => {
      console.log("closed", code, reason && reason.toString());
      attempts++;
      console.log(
        `reconnecting in ${Math.min(
          1000 * Math.pow(2, attempts - 1),
          MAX_BACKOFF
        )} ms`
      );
      connect();
    });

    ws.on("error", (err) => {
      console.error("error", err.message || err);
      // close will fire and reconnect
    });
  }, delay);
}

connect();
