const { Server } = require("socket.io");
const { verifyAccessToken } = require("./jwt");
const env = require("../config/env");
const User = require("../models/User");
const Order = require("../models/Order");

let io = null;

/**
 * Attach Socket.IO to an existing HTTP server.
 * Call once during bootstrap, after connectDb().
 */
const initSocketIO = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: env.clientOrigin === "*" ? true : env.clientOrigin,
      credentials: true,
    },
    // Clients should send their JWT as `auth.token`
    // e.g. io("http://…", { auth: { token: "Bearer …" } })
  });

  // ── JWT authentication middleware ──────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const raw = socket.handshake.auth?.token || "";
      // Accept both "Bearer <token>" and plain "<token>"
      const token = raw.startsWith("Bearer ") ? raw.slice(7) : raw;
      if (!token) return next(new Error("Authentication token missing"));

      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.sub).select("role storeId status");
      if (!user) return next(new Error("User not found"));
      if (user.status !== "active") return next(new Error("Account is not active"));

      // Attach user context to the socket — mirrors req.user in REST routes
      socket.user = {
        id: user._id.toString(),
        role: user.role,
        storeId: user.storeId ? user.storeId.toString() : null,
      };

      next();
    } catch (_err) {
      next(new Error("Invalid or expired access token"));
    }
  });

  // ── Connection handler ────────────────────────────────────────────
  io.on("connection", (socket) => {
    const { id, role, storeId } = socket.user;

    // Auto-join user-specific room (every authenticated user)
    socket.join(`user:${id}`);

    // Vendors automatically join their store room
    if (role === "vendor" && storeId) {
      socket.join(`store:${storeId}`);
    }

    // Admins join the global admin feed
    if (role === "admin") {
      socket.join("admin:orders");
    }

    // ── Client-initiated: subscribe to a specific order ─────────
    socket.on("join:order", async (orderId, ack) => {
      try {
        if (!orderId || typeof orderId !== "string") {
          return typeof ack === "function"
            ? ack({ error: "orderId is required" })
            : undefined;
        }

        // Admins can watch any order; vendors can watch their store's
        // orders; customers can only watch their own.
        const order = await Order.findById(orderId).select("customer store");
        if (!order) {
          return typeof ack === "function"
            ? ack({ error: "Order not found" })
            : undefined;
        }

        const isOwner = order.customer.toString() === id;
        const isStoreVendor =
          role === "vendor" && storeId === order.store.toString();
        const isAdmin = role === "admin";

        if (!isOwner && !isStoreVendor && !isAdmin) {
          return typeof ack === "function"
            ? ack({ error: "Not authorized" })
            : undefined;
        }

        socket.join(`order:${orderId}`);
        if (typeof ack === "function") ack({ joined: true });
      } catch (_err) {
        if (typeof ack === "function") ack({ error: "Server error" });
      }
    });

    // ── Client-initiated: unsubscribe from an order ─────────────
    socket.on("leave:order", (orderId) => {
      if (orderId && typeof orderId === "string") {
        socket.leave(`order:${orderId}`);
      }
    });

    // eslint-disable-next-line no-console
    console.log(
      `[Socket.IO] ${role} ${id} connected (rooms: ${Array.from(socket.rooms).join(", ")})`
    );

    socket.on("disconnect", () => {
      // eslint-disable-next-line no-console
      console.log(`[Socket.IO] ${role} ${id} disconnected`);
    });
  });

  // eslint-disable-next-line no-console
  console.log("[Socket.IO] Initialized");
  return io;
};

/** Return the live IO instance (null before init). */
const getIO = () => io;

module.exports = { initSocketIO, getIO };
