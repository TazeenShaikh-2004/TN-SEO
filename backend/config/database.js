import dns from "node:dns";
import mongoose from "mongoose";

/**
 * Some Node builds on Windows report the loopback address as the only DNS
 * server. Nothing listens there, so every lookup fails with ECONNREFUSED and
 * MongoDB's SRV resolution never succeeds. Detect that case and fall back to
 * public resolvers before connecting.
 */
const LOOPBACK_DNS = new Set(["127.0.0.1", "127.0.0.53", "::1", "0.0.0.0"]);

function ensureUsableDns() {
    const servers = dns.getServers();
    if (!servers.some((server) => LOOPBACK_DNS.has(server))) return;

    const usable = servers.filter((server) => !LOOPBACK_DNS.has(server));
    const fallback = [...new Set([...usable, "8.8.8.8", "1.1.1.1", "192.168.0.1"])];

    dns.setServers(fallback);
    console.warn(
        `[db] DNS resolver ${servers.join(", ")} is unusable - switched to ${dns.getServers().join(", ")}`
    );
}


/**
 * MongoDB connection.
 *
 * - Uses `MONGO_URI` from the environment whenever it is set (required in production).
 * - In development only, falls back to an in-memory MongoDB so the app can be
 *   run locally without a system-wide MongoDB installation.
 */
let memoryServer = null;

export async function connectDB() {
    ensureUsableDns();

    let uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    let mongoUri = uri;

    if (!mongoUri) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("MONGO_URI is not set. Configure it before running in production.");
        }

        let MongoMemoryServer;
        try {
            ({ MongoMemoryServer } = await import("mongodb-memory-server"));
        } catch {
            throw new Error(
                "MONGO_URI is not set and the in-memory MongoDB fallback is not installed. " +
                    "Run `npm install` inside the server/ folder or set MONGO_URI."
            );
        }

        memoryServer = await MongoMemoryServer.create();
        mongoUri = memoryServer.getUri("tn-seo");
        console.warn("[db] WARNING: MONGO_URI not set - using an in-memory MongoDB (data resets on restart!).");
    } else {
        const cleanUri = mongoUri.split("?")[0];
        if (cleanUri.endsWith(".mongodb.net")) {
            mongoUri = mongoUri.replace(".mongodb.net", ".mongodb.net/tn-seo");
        } else if (cleanUri.endsWith(".mongodb.net/")) {
            mongoUri = mongoUri.replace(".mongodb.net/", ".mongodb.net/tn-seo");
        }
    }

    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
    console.log("[db] MongoDB connected successfully");

    return memoryServer;
}

export async function disconnectDB() {
    await mongoose.disconnect();
    if (memoryServer) {
        await memoryServer.stop();
        memoryServer = null;
    }
}
