import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";

type SocketContextValue = {
  socket: Socket | null;
  isConnected: boolean;
};

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Connect to the backend same-origin or absolute URL
    // Pass JWT token in auth handshake to identify user
    const socketUrl = api.baseUrl.startsWith("/")
      ? typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:4000"
      : api.baseUrl;

    console.log(`[socket] Connecting to ${socketUrl}`);
    const nextSocket = io(socketUrl, {
      auth: { token },
      transports: ["websocket"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    nextSocket.on("connect", () => {
      console.log("[socket] Connected:", nextSocket.id);
      setIsConnected(true);
    });

    nextSocket.on("disconnect", (reason) => {
      console.log("[socket] Disconnected:", reason);
      setIsConnected(false);
    });

    nextSocket.on("connect_error", (error) => {
      console.warn("[socket] Connection error:", error.message);
    });

    nextSocket.on("auth:error", (payload: { message?: string }) => {
      console.warn("[socket] Authentication error:", payload?.message ?? "unknown");
      setIsConnected(false);
    });

    nextSocket.io.on("reconnect_attempt", (attempt) => {
      if (attempt <= 3 || attempt % 10 === 0) {
        console.warn(`[socket] Reconnect attempt ${attempt} to ${socketUrl}`);
      }
    });

    nextSocket.io.on("reconnect_failed", () => {
      console.warn("[socket] Reconnect failed");
    });

    setSocket(nextSocket);

    return () => {
      nextSocket.disconnect();
    };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used inside SocketProvider");
  }
  return context;
}
