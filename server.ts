import { createServer, IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

interface Dot {
  id: string;
  x: number;
  y: number;
  color: string;
  userId: string;
  timestamp: number;
}

interface Room {
  hostId: string;
  hostSocketId: string;
  viewers: Map<string, string>;
  dots: Dot[];
}

const rooms = new Map<string, Room>();

app.prepare().then(() => {
  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    const parsedUrl = parse(req.url!, true);

    // Socket.io polling isteklerini yakala - Next.js'e GÖNDERMEMELİYİZ
    if (parsedUrl.pathname?.startsWith("/api/socketio")) {
      // Socket.io bu istekleri kendi halleder, burada sadece Next.js'e gitmesini engelliyoruz
      // Socket.io kendi listener'larını httpServer'a bağlar
      return;
    }

    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    path: "/api/socketio",
    addTrailingSlash: false,
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    // Sadece websocket kullanalım - polling soruna neden oluyor
    transports: ["websocket"],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on("connection", (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ========== ODA OLUŞTURMA ==========
    socket.on("create-room", (roomId: string, callback: (success: boolean) => void) => {
      if (rooms.has(roomId)) {
        callback(false);
        return;
      }

      const room: Room = {
        hostId: socket.id,
        hostSocketId: socket.id,
        viewers: new Map(),
        dots: [],
      };

      rooms.set(roomId, room);
      socket.join(roomId);
      console.log(`[Room] Created: ${roomId} by ${socket.id}`);
      callback(true);
    });

    // ========== ODAYA KATILMA ==========
    socket.on("join-room", (roomId: string, callback: (data: { success: boolean; dots?: Dot[]; hostSocketId?: string }) => void) => {
      const room = rooms.get(roomId);
      if (!room) {
        callback({ success: false });
        return;
      }

      room.viewers.set(socket.id, socket.id);
      socket.join(roomId);

      io.to(room.hostSocketId).emit("viewer-joined", {
        viewerSocketId: socket.id,
      });

      console.log(`[Room] ${socket.id} joined ${roomId}`);
      callback({
        success: true,
        dots: room.dots,
        hostSocketId: room.hostSocketId,
      });
    });

    // ========== WEBRTC SIGNALING ==========
    socket.on("webrtc-offer", (data: { targetSocketId: string; offer: RTCSessionDescriptionInit }) => {
      io.to(data.targetSocketId).emit("webrtc-offer", {
        offer: data.offer,
        fromSocketId: socket.id,
      });
    });

    socket.on("webrtc-answer", (data: { targetSocketId: string; answer: RTCSessionDescriptionInit }) => {
      io.to(data.targetSocketId).emit("webrtc-answer", {
        answer: data.answer,
        fromSocketId: socket.id,
      });
    });

    socket.on("webrtc-ice-candidate", (data: { targetSocketId: string; candidate: RTCIceCandidateInit }) => {
      io.to(data.targetSocketId).emit("webrtc-ice-candidate", {
        candidate: data.candidate,
        fromSocketId: socket.id,
      });
    });

    // ========== NOKTA İŞLEMLERİ ==========
    socket.on("add-dot", (data: { roomId: string; dot: Dot }) => {
      const room = rooms.get(data.roomId);
      if (!room) return;

      room.dots.push(data.dot);
      io.to(data.roomId).emit("dot-added", data.dot);
      console.log(`[Dot] Added in room ${data.roomId}: (${data.dot.x.toFixed(1)}%, ${data.dot.y.toFixed(1)}%)`);
    });

    socket.on("clear-dots", (roomId: string) => {
      const room = rooms.get(roomId);
      if (!room) return;
      if (room.hostSocketId !== socket.id) return;

      room.dots = [];
      io.to(roomId).emit("dots-cleared");
      console.log(`[Dot] Cleared all in room ${roomId}`);
    });

    // ========== BAĞLANTI KOPMA ==========
    socket.on("disconnect", () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);

      for (const [roomId, room] of rooms.entries()) {
        if (room.hostSocketId === socket.id) {
          io.to(roomId).emit("room-closed");
          rooms.delete(roomId);
          console.log(`[Room] Closed: ${roomId} (host left)`);
        } else if (room.viewers.has(socket.id)) {
          room.viewers.delete(socket.id);
          io.to(room.hostSocketId).emit("viewer-left", {
            viewerSocketId: socket.id,
          });
          console.log(`[Room] Viewer left: ${socket.id} from ${roomId}`);
        }
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
