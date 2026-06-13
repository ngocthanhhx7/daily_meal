import { Server as SocketServer, Socket } from "socket.io";
import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { Conversation } from "../models/Conversation.js";
import { hasBlockBetween } from "../utils/userSafety.js";

let io: SocketServer | undefined;

// Map to track user active sockets: userId -> Set<socketId>
const userSockets = new Map<string, Set<string>>();

type HandshakeAuth = {
  token?: string;
};

function emitRoomError(socket: Socket, room: string, message: string) {
  socket.emit("room:error", { room, message });
}

export function initSocket(server: HttpServer) {
  io = new SocketServer(server, {
    cors: {
      origin: env.CLIENT_ORIGIN === "*" ? true : env.CLIENT_ORIGIN,
      credentials: true
    }
  });

  io.on("connection", (socket: Socket) => {
    let userId: string | undefined;

    // Authenticate connection via token in auth handshake or query.
    const auth = socket.handshake.auth as HandshakeAuth | undefined;
    const token = auth?.token ?? (socket.handshake.query.token as string | undefined);

    if (!token) {
      socket.emit("auth:error", { message: "Authentication required" });
      socket.disconnect(true);
      return;
    }

    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
      userId = payload.sub;

      if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
      }
      userSockets.get(userId)!.add(socket.id);
      console.log(`Socket user authenticated: ${userId} (${socket.id})`);
    } catch (err) {
      console.warn(`Invalid token supplied to Socket.io connection: ${socket.id}`);
      socket.emit("auth:error", { message: "Invalid session" });
      socket.disconnect(true);
      return;
    }

    socket.on("join-post", (postId: string) => {
      const room = `post:${postId}`;
      if (!userId) {
        emitRoomError(socket, room, "Authentication required");
        return;
      }

      socket.join(room);
      console.log(`Socket ${socket.id} joined post room: ${room}`);
    });

    socket.on("leave-post", (postId: string) => {
      const room = `post:${postId}`;
      socket.leave(room);
      console.log(`Socket ${socket.id} left post room: ${room}`);
    });

    socket.on("join-conversation", async (conversationId: string) => {
      const room = `conversation:${conversationId}`;
      if (!userId) {
        emitRoomError(socket, room, "Authentication required");
        return;
      }

      try {
        const conversation = await Conversation.exists({
          _id: conversationId,
          participants: userId
        });

        if (!conversation) {
          emitRoomError(socket, room, "Conversation not found");
          return;
        }

        const conversationDoc = await Conversation.findById(conversationId).select("participants").lean();
        if (!conversationDoc) {
          emitRoomError(socket, room, "Conversation not found");
          return;
        }

        for (const participant of conversationDoc.participants) {
          const participantId = participant.toString();
          if (participantId !== userId && (await hasBlockBetween(userId, participantId))) {
            emitRoomError(socket, room, "Conversation not found");
            return;
          }
        }

        socket.join(room);
        console.log(`Socket ${socket.id} joined chat room: ${room}`);
      } catch (error) {
        emitRoomError(socket, room, "Conversation not found");
      }
    });

    socket.on("leave-conversation", (conversationId: string) => {
      const room = `conversation:${conversationId}`;
      socket.leave(room);
      console.log(`Socket ${socket.id} left chat room: ${room}`);
    });

    socket.on("disconnect", () => {
      if (userId && userSockets.has(userId)) {
        const sockets = userSockets.get(userId)!;
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
        }
        console.log(`User disconnected: ${userId} (${socket.id})`);
      } else {
        console.log(`Anonymous socket disconnected: ${socket.id}`);
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

export function broadcastGlobal(event: string, data: unknown) {
  if (!io) return;
  io.emit(event, data);
}
