// main.js - Run all services with a single command
require("dotenv").config();
const { spawn } = require("child_process");
const path = require("path");

class ServiceManager {
  constructor() {
    this.services = [];
    this.isShuttingDown = false;
  }

  startService(name, scriptPath, cwd = process.cwd()) {
    console.log(`🚀 Starting ${name}...`);
    
    const service = spawn("node", [scriptPath], {
      cwd,
      stdio: "inherit", // This will pipe output to main process
      env: { ...process.env } // Pass all environment variables
    });

    service.on("error", (err) => {
      console.error(`❌ Error starting ${name}:`, err);
    });

    service.on("close", (code) => {
      if (!this.isShuttingDown) {
        console.log(`⚠️  ${name} exited with code ${code}`);
        if (code !== 0) {
          console.log(`🔄 Restarting ${name} in 3 seconds...`);
          setTimeout(() => {
            if (!this.isShuttingDown) {
              this.startService(name, scriptPath, cwd);
            }
          }, 3000);
        }
      }
    });

    this.services.push({
      name,
      process: service,
      scriptPath,
      cwd
    });

    console.log(`✅ ${name} started with PID: ${service.pid}`);
    return service;
  }

  async checkConnections() {
    console.log("🔍 Checking database connections...");
    
    const { Client } = require("pg");
    const Redis = require("ioredis");

    try {
      // Test Postgres
      const pg = new Client({ connectionString: process.env.DATABASE_URL });
      await pg.connect();
      const res = await pg.query("SELECT NOW() AS time");
      console.log("✅ Postgres connected, server time:", res.rows[0].time);
      await pg.end();

      // Test Redis
      const redis = new Redis(process.env.REDIS_URL);
      await redis.set("startup_test", "ok");
      const value = await redis.get("startup_test");
      console.log("✅ Redis connected, test value:", value);
      redis.disconnect();

      return true;
    } catch (err) {
      console.error("❌ Connection test failed:", err.message);
      return false;
    }
  }

  async start() {
    console.log("🎬 Starting Order Updates System...");
    console.log("=====================================");

    // Check if environment variables are set
    if (!process.env.DATABASE_URL || !process.env.REDIS_URL) {
      console.error("❌ Missing required environment variables:");
      console.error("   - DATABASE_URL:", process.env.DATABASE_URL ? "✅" : "❌");
      console.error("   - REDIS_URL:", process.env.REDIS_URL ? "✅" : "❌");
      console.error("\nPlease create a .env file with these variables.");
      process.exit(1);
    }

    // Test connections before starting services
    const connectionsOk = await this.checkConnections();
    if (!connectionsOk) {
      console.error("❌ Cannot start services - database connections failed");
      process.exit(1);
    }

    console.log("\n🔧 Starting services...");
    console.log("========================");

    // Start Publisher (Postgres -> Redis)
    this.startService(
      "Publisher", 
      "index.js", 
      path.join(__dirname, "publisher")
    );

    // Wait a bit for publisher to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Start WebSocket Server (Redis -> WebSocket)
    this.startService(
      "WebSocket Server", 
      "index.js", 
      path.join(__dirname, "ws-server")
    );

    console.log("\n🎉 All services started!");
    console.log("========================");
    console.log("📊 System Overview:");
    console.log(`   • Publisher: Postgres notifications → Redis`);
    console.log(`   • WebSocket Server: Redis → WebSocket clients (port ${process.env.PORT || 8080})`);
    console.log(
      `   • Client Demo: Open http://127.0.0.1:5500/client-demo/index.html in browser`
    );
    console.log("\n💡 Tips:");
    console.log("   • Press Ctrl+C to stop all services");
    console.log("   • Check logs above for any connection issues");
    console.log("   • Services will auto-restart if they crash");
  }

  shutdown() {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    console.log("\n🛑 Shutting down all services...");
    
    this.services.forEach(service => {
      console.log(`   Stopping ${service.name}...`);
      try {
        service.process.kill("SIGTERM");
      } catch (err) {
        console.log(`   Force killing ${service.name}...`);
        service.process.kill("SIGKILL");
      }
    });

    setTimeout(() => {
      console.log("✅ All services stopped. Goodbye!");
      process.exit(0);
    }, 2000);
  }
}

// Create service manager instance
const serviceManager = new ServiceManager();

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n📡 Received SIGINT signal...");
  serviceManager.shutdown();
});

process.on("SIGTERM", () => {
  console.log("\n📡 Received SIGTERM signal...");
  serviceManager.shutdown();
});

process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err);
  serviceManager.shutdown();
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
  serviceManager.shutdown();
});

// Start the system
serviceManager.start().catch((err) => {
  console.error("💥 Failed to start system:", err);
  process.exit(1);
});