import "dotenv/config";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { prisma } from "./src/lib/prisma";

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
  password: string;
  viewers: Map<string, string>;
  dots: Dot[];
}

const rooms = new Map<string, Room>();

// Socket'ten IP adresi al
function getSocketIp(socket: {
  handshake: {
    address: string;
    headers: Record<string, string | string[] | undefined>;
  };
}): string {
  const forwarded = socket.handshake.headers["x-forwarded-for"];
  if (forwarded) {
    const ip = Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded.split(",")[0];
    return ip.trim();
  }
  return socket.handshake.address || "unknown";
}

app.prepare().then(() => {
  const httpServer = createServer(
    (req: IncomingMessage, res: ServerResponse) => {
      const parsedUrl = parse(req.url!, true);

      if (parsedUrl.pathname?.startsWith("/api/socketio")) {
        return;
      }

      handle(req, res, parsedUrl);
    },
  );

  const io = new SocketIOServer(httpServer, {
    path: "/api/socketio",
    addTrailingSlash: false,
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket"],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on("connection", (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ========== ODA OLUŞTURMA ==========
    socket.on(
      "create-room",
      async (
        data: { roomId: string; password: string },
        callback: (result: { success: boolean; error?: string }) => void,
      ) => {
        const { roomId, password } = data;

        if (rooms.has(roomId)) {
          callback({ success: false, error: "Bu oda ID zaten kullanılıyor." });
          return;
        }

        if (!password || password.length < 1) {
          callback({ success: false, error: "Oda şifresi gereklidir." });
          return;
        }

        const hostIp = getSocketIp(socket);
        const hostAgent =
          (socket.handshake.headers["user-agent"] as string) || undefined;

        // Veritabanına kaydet
        try {
          await prisma.room.create({
            data: {
              roomCode: roomId,
              password: password,
              hostIp: hostIp,
              hostAgent: hostAgent,
              isActive: true,
            },
          });
          console.log(`[DB] Room saved: ${roomId} (IP: ${hostIp})`);
        } catch (err) {
          console.error(`[DB] Error saving room:`, err);
          // DB hatası olsa bile memory'de oda oluştur
        }

        const room: Room = {
          hostId: socket.id,
          hostSocketId: socket.id,
          password: password,
          viewers: new Map(),
          dots: [],
        };

        rooms.set(roomId, room);
        socket.join(roomId);
        console.log(`[Room] Created: ${roomId} by ${socket.id}`);
        callback({ success: true });
      },
    );

    // ========== ODAYA KATILMA ==========
    socket.on(
      "join-room",
      (
        data: { roomId: string; password: string },
        callback: (result: {
          success: boolean;
          dots?: Dot[];
          hostSocketId?: string;
          error?: string;
        }) => void,
      ) => {
        const { roomId, password } = data;
        const room = rooms.get(roomId);

        if (!room) {
          callback({ success: false, error: "Oda bulunamadı." });
          return;
        }

        // Şifre kontrolü
        if (room.password !== password) {
          callback({ success: false, error: "Oda şifresi yanlış." });
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
      },
    );

    // ========== WEBRTC SIGNALING ==========
    socket.on(
      "webrtc-offer",
      (data: { targetSocketId: string; offer: RTCSessionDescriptionInit }) => {
        io.to(data.targetSocketId).emit("webrtc-offer", {
          offer: data.offer,
          fromSocketId: socket.id,
        });
      },
    );

    socket.on(
      "webrtc-answer",
      (data: { targetSocketId: string; answer: RTCSessionDescriptionInit }) => {
        io.to(data.targetSocketId).emit("webrtc-answer", {
          answer: data.answer,
          fromSocketId: socket.id,
        });
      },
    );

    socket.on(
      "webrtc-ice-candidate",
      (data: { targetSocketId: string; candidate: RTCIceCandidateInit }) => {
        io.to(data.targetSocketId).emit("webrtc-ice-candidate", {
          candidate: data.candidate,
          fromSocketId: socket.id,
        });
      },
    );

    // ========== NOKTA İŞLEMLERİ ==========
    socket.on("add-dot", (data: { roomId: string; dot: Dot }) => {
      const room = rooms.get(data.roomId);
      if (!room) return;

      room.dots.push(data.dot);
      io.to(data.roomId).emit("dot-added", data.dot);
      console.log(
        `[Dot] Added in room ${data.roomId}: (${data.dot.x.toFixed(1)}%, ${data.dot.y.toFixed(1)}%)`,
      );
    });

    socket.on("clear-dots", (roomId: string) => {
      const room = rooms.get(roomId);
      if (!room) return;

      // Hem host hem de viewer temizleyebilir
      room.dots = [];
      io.to(roomId).emit("dots-cleared");
      console.log(`[Dot] Cleared all in room ${roomId} by ${socket.id}`);
    });

    // ========== BAĞLANTI KOPMA ==========
    socket.on("disconnect", async () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);

      for (const [roomId, room] of rooms.entries()) {
        if (room.hostSocketId === socket.id) {
          io.to(roomId).emit("room-closed");
          rooms.delete(roomId);

          // Veritabanında odayı kapat
          try {
            await prisma.room.updateMany({
              where: { roomCode: roomId, isActive: true },
              data: { isActive: false, closedAt: new Date() },
            });
            console.log(`[DB] Room closed: ${roomId}`);
          } catch (err) {
            console.error(`[DB] Error closing room:`, err);
          }

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
