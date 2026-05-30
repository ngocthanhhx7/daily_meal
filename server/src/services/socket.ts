import { Server as SocketServer, Socket } from "socket.io";
import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

let io: SocketServer | undefined;

// Map to track user active sockets: userId -> Set<socketId>
const userSockets = new Map<string, Set<string>>();

type HandshakeAuth = {
  token?: string;
};

export function initSocket(server: HttpServer) {
  io = new SocketServer(server, {
    cors: {
      origin: env.CLIENT_ORIGIN === "*" ? true : env.CLIENT_ORIGIN,
      credentials: true
    }
  });

  io.on("connection", (socket: Socket) => {
    let userId: string | undefined;

    // Authenticate connection via token in auth handshake or query
    const auth = socket.handshake.auth as HandshakeAuth | undefined;
    const token = auth?.token ?? (socket.handshake.query.token as string | undefined);

    if (token) {
      try {
        const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
        userId = payload.sub;

        if (!userSockets.has(userId)) {
          userSockets.set(userId, new Set());
        }
        userSockets.get(userId)!.add(socket.id);
        console.log(`🔌 User authenticated: ${userId} (Socket: ${socket.id})`);
      } catch (err) {
        console.warn(`⚠️ Invalid token supplied to Socket.io connection: ${socket.id}`);
      }
    } else {
      console.log(`🔌 Anonymous socket connected: ${socket.id}`);
    }

    // Join room for a specific post (e.g. comments updates)
    socket.on("join-post", (postId: string) => {
      socket.join(`post:${postId}`);
      console.log(`👁️ Socket ${socket.id} joined post room: post:${postId}`);
    });

    // Leave room for a specific post
    socket.on("leave-post", (postId: string) => {
      socket.leave(`post:${postId}`);
      console.log(`🚪 Socket ${socket.id} left post room: post:${postId}`);
    });

    // Join room for a specific chat conversation
    socket.on("join-conversation", (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`💬 Socket ${socket.id} joined chat room: conversation:${conversationId}`);
    });

    // Leave room for a specific chat conversation
    socket.on("leave-conversation", (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
      console.log(`🚪 Socket ${socket.id} left chat room: conversation:${conversationId}`);
    });

    socket.on("disconnect", () => {
      if (userId && userSockets.has(userId)) {
        const sockets = userSockets.get(userId)!;
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
        }
        console.log(`❌ User disconnected: ${userId} (Socket: ${socket.id})`);
      } else {
        console.log(`❌ Anonymous socket disconnected: ${socket.id}`);
      }
    });
  });

  return io;
}

export function emitToUser(userId: string, event: string, data: unknown) {
  if (!io) return;
  const sockets = userSockets.get(userId);
  if (sockets) {
    for (const socketId of sockets) {
      io.to(socketId).emit(event, data);
    }
  }
}

export function broadcastToRoom(room: string, event: string, data: unknown, excludeSocketId?: string) {
  if (!io) return;
  if (excludeSocketId) {
    io.to(room).except(excludeSocketId).emit(event, data);
  } else {
    io.to(room).emit(event, data);
  }
}
