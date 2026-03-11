"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Dot } from "@/types";
import { v4 as uuidv4 } from "uuid";
import Link from "next/link";
import { io, Socket } from "socket.io-client";

const COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#ffffff",
];

export default function RoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = (params.id as string).toUpperCase();
  const role = searchParams.get("role") || "viewer";
  const isHost = role === "host";

  const [isConnected, setIsConnected] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [dots, setDots] = useState<Dot[]>([]);
  const [selectedColor, setSelectedColor] = useState(COLORS[4]);
  const [viewerCount, setViewerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hasStream, setHasStream] = useState(false);
  // Video içerik alanının gerçek boyut/pozisyonu (letterbox hesaplanmış)
  const [videoContentRect, setVideoContentRect] = useState<{
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoWrapperRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const socketRef = useRef<Socket | null>(null);
  const userIdRef = useRef(uuidv4().slice(0, 8));
  const popoutWindowRef = useRef<Window | null>(null);
  const cleanedUpRef = useRef(false);
  const connectedViewersRef = useRef<Set<string>>(new Set());

  // ========== VIDEO İÇERİK ALANI HESAPLAMA ==========
  // object-fit: contain kullanıldığında videonun gerçek render alanını hesapla
  const calculateVideoContentRect = useCallback(() => {
    const video = videoRef.current;
    const wrapper = videoWrapperRef.current;
    if (!video || !wrapper || !video.videoWidth || !video.videoHeight) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const wrapperW = wrapperRect.width;
    const wrapperH = wrapperRect.height;

    const videoAspect = video.videoWidth / video.videoHeight;
    const wrapperAspect = wrapperW / wrapperH;

    let renderedW: number, renderedH: number, offsetX: number, offsetY: number;

    if (wrapperAspect > videoAspect) {
      // Container daha geniş → yanlarda boşluk var
      renderedH = wrapperH;
      renderedW = wrapperH * videoAspect;
      offsetX = (wrapperW - renderedW) / 2;
      offsetY = 0;
    } else {
      // Container daha uzun → üst/altta boşluk var
      renderedW = wrapperW;
      renderedH = wrapperW / videoAspect;
      offsetX = 0;
      offsetY = (wrapperH - renderedH) / 2;
    }

    setVideoContentRect({
      offsetX,
      offsetY,
      width: renderedW,
      height: renderedH,
    });
  }, []);

  // Video metadata yüklendiğinde ve pencere boyutu değiştiğinde hesapla
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleResize = () => calculateVideoContentRect();
    const handleLoadedMetadata = () => calculateVideoContentRect();
    const handlePlay = () => calculateVideoContentRect();

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("play", handlePlay);
    video.addEventListener("resize", handleResize);
    window.addEventListener("resize", handleResize);

    // İlk hesaplama
    if (video.videoWidth && video.videoHeight) {
      calculateVideoContentRect();
    }

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("resize", handleResize);
      window.removeEventListener("resize", handleResize);
    };
  }, [calculateVideoContentRect, isBroadcasting, hasStream]);

  // ========== CREATE PEER CONNECTION ==========
  const createPeerConnection = useCallback(
    (remoteSocketId: string, socket: Socket): RTCPeerConnection => {
      const existingPc = peerConnectionsRef.current.get(remoteSocketId);
      if (existingPc) {
        existingPc.close();
      }

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("webrtc-ice-candidate", {
            targetSocketId: remoteSocketId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(
          `[WebRTC] Connection state with ${remoteSocketId}: ${pc.connectionState}`,
        );
      };

      // Viewer receives track
      if (!isHost) {
        pc.ontrack = (event) => {
          console.log(
            "[WebRTC] Received track from host!",
            event.streams.length,
            "streams",
          );
          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
            videoRef.current.play().catch(console.error);
            setHasStream(true);
          }
        };
      }

      peerConnectionsRef.current.set(remoteSocketId, pc);
      return pc;
    },
    [isHost],
  );

  // ========== Stream'i bir izleyiciye gönder ==========
  const sendStreamToViewer = useCallback(
    async (viewerSocketId: string, stream: MediaStream, socket: Socket) => {
      try {
        console.log("[Host] Sending stream to viewer:", viewerSocketId);
        const pc = createPeerConnection(viewerSocketId, socket);

        stream.getTracks().forEach((track) => {
          console.log("[Host] Adding track:", track.kind, track.label);
          pc.addTrack(track, stream);
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("webrtc-offer", {
          targetSocketId: viewerSocketId,
          offer: offer,
        });

        console.log("[Host] WebRTC offer sent to:", viewerSocketId);
      } catch (err) {
        console.error("[Host] Error sending stream to viewer:", err);
      }
    },
    [createPeerConnection],
  );

  // ========== SOCKET CONNECTION ==========
  useEffect(() => {
    if (cleanedUpRef.current) return;

    const socket = io({
      path: "/api/socketio",
      addTrailingSlash: false,
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      setIsConnected(true);

      const password = searchParams.get("pwd") || "";

      if (isHost) {
        socket.emit(
          "create-room",
          { roomId, password },
          (result: { success: boolean; error?: string }) => {
            if (!result.success) {
              setError(result.error || "Oda oluşturulamadı.");
            } else {
              console.log("[Host] Room created:", roomId);
            }
          },
        );
      } else {
        socket.emit(
          "join-room",
          { roomId, password },
          (result: {
            success: boolean;
            dots?: Dot[];
            hostSocketId?: string;
            error?: string;
          }) => {
            if (!result.success) {
              setError(result.error || "Odaya katılınamadı.");
              return;
            }
            console.log("[Viewer] Joined room:", roomId);
            if (result.dots) {
              setDots(result.dots);
            }
          },
        );
      }
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("dot-added", (dot: Dot) => {
      setDots((prev) => [...prev, dot]);
    });

    socket.on("dots-cleared", () => {
      setDots([]);
    });

    socket.on("room-closed", () => {
      setError("Yayıncı odadan ayrıldı. Oda kapatıldı.");
      setIsBroadcasting(false);
    });

    // WebRTC signaling - viewer side
    if (!isHost) {
      socket.on(
        "webrtc-offer",
        async (data: {
          offer: RTCSessionDescriptionInit;
          fromSocketId: string;
        }) => {
          try {
            console.log("[Viewer] Received WebRTC offer from host");
            const pc = createPeerConnection(data.fromSocketId, socket);
            await pc.setRemoteDescription(
              new RTCSessionDescription(data.offer),
            );
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socket.emit("webrtc-answer", {
              targetSocketId: data.fromSocketId,
              answer: answer,
            });
            console.log("[Viewer] Sent WebRTC answer to host");
          } catch (err) {
            console.error("[Viewer] Error handling offer:", err);
          }
        },
      );
    }

    // WebRTC signaling - host side
    if (isHost) {
      socket.on("viewer-joined", async (data: { viewerSocketId: string }) => {
        console.log("[Host] Viewer joined:", data.viewerSocketId);
        setViewerCount((prev) => prev + 1);
        connectedViewersRef.current.add(data.viewerSocketId);

        // Eğer zaten yayın yapılıyorsa, yeni izleyiciye stream gönder
        if (streamRef.current) {
          console.log("[Host] Stream exists, sending to new viewer");
          sendStreamToViewer(data.viewerSocketId, streamRef.current, socket);
        } else {
          console.log(
            "[Host] No stream yet, viewer will receive when broadcast starts",
          );
        }
      });

      socket.on("viewer-left", (data: { viewerSocketId: string }) => {
        setViewerCount((prev) => Math.max(0, prev - 1));
        connectedViewersRef.current.delete(data.viewerSocketId);
        const pc = peerConnectionsRef.current.get(data.viewerSocketId);
        if (pc) {
          pc.close();
          peerConnectionsRef.current.delete(data.viewerSocketId);
        }
      });
    }

    // ICE candidate handling
    socket.on(
      "webrtc-ice-candidate",
      (data: { candidate: RTCIceCandidateInit; fromSocketId: string }) => {
        const pc = peerConnectionsRef.current.get(data.fromSocketId);
        if (pc) {
          pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(
            console.error,
          );
        }
      },
    );

    // Answer handling
    socket.on(
      "webrtc-answer",
      async (data: {
        answer: RTCSessionDescriptionInit;
        fromSocketId: string;
      }) => {
        const pc = peerConnectionsRef.current.get(data.fromSocketId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log("[Host] WebRTC answer received, connection established");
        }
      },
    );

    return () => {
      cleanedUpRef.current = true;
      socket.disconnect();

      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      if (popoutWindowRef.current && !popoutWindowRef.current.closed) {
        popoutWindowRef.current.close();
      }
    };
  }, [roomId, isHost, createPeerConnection, sendStreamToViewer]);

  // ========== SYNC VIDEO SRCOBJECT ==========
  // Video element'ine stream'i bağla (re-render sonrası da çalışır)
  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        console.log("[Video] Setting srcObject on video element");
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(console.error);
      }
    }
  }, [isBroadcasting, hasStream]);

  // ========== START BROADCAST ==========
  const startBroadcast = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
        } as MediaTrackConstraints,
        audio: false,
      });

      console.log(
        "[Host] Got display media stream, tracks:",
        stream.getTracks().length,
      );
      streamRef.current = stream;

      // State'i güncelle - bu re-render tetikler ve video elementi görünür olur
      setIsBroadcasting(true);
      setHasStream(true);

      // Zaten bağlı olan izleyicilere stream gönder
      const socket = socketRef.current;
      if (socket) {
        console.log(
          "[Host] Broadcasting to existing viewers:",
          connectedViewersRef.current.size,
        );
        for (const viewerSocketId of connectedViewersRef.current) {
          sendStreamToViewer(viewerSocketId, stream, socket);
        }
      }

      // Ekran paylaşımı durdurulursa
      stream.getVideoTracks()[0].onended = () => {
        console.log("[Host] Screen share ended");
        setIsBroadcasting(false);
        setHasStream(false);
        streamRef.current = null;
      };
    } catch (err) {
      console.error("Screen share error:", err);
    }
  };

  // ========== ADD DOT (VIEWER) ==========
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isHost || !socketRef.current || !videoContentRect) return;

    const wrapperRect = videoWrapperRef.current?.getBoundingClientRect();
    if (!wrapperRect) return;

    // Tıklanan piksel pozisyonunu wrapper'a göre al
    const clickX = e.clientX - wrapperRect.left;
    const clickY = e.clientY - wrapperRect.top;

    // Video içerik alanına göre yüzde hesapla
    const x =
      ((clickX - videoContentRect.offsetX) / videoContentRect.width) * 100;
    const y =
      ((clickY - videoContentRect.offsetY) / videoContentRect.height) * 100;

    // Video dışına tıklanmışsa yoksay (letterbox alanı)
    if (x < 0 || x > 100 || y < 0 || y > 100) return;

    const dot: Dot = {
      id: uuidv4(),
      x,
      y,
      color: selectedColor,
      userId: userIdRef.current,
      timestamp: Date.now(),
    };

    socketRef.current.emit("add-dot", { roomId, dot });
  };

  // ========== CLEAR DOTS (HOST) ==========
  const clearDots = () => {
    if (socketRef.current) {
      socketRef.current.emit("clear-dots", roomId);
    }
  };

  // ========== COPY ROOM ID ==========
  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const el = document.createElement("textarea");
      el.value = roomId;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  // Send dots to pop-out
  useEffect(() => {
    if (popoutWindowRef.current && !popoutWindowRef.current.closed) {
      popoutWindowRef.current.postMessage({ type: "dots-update", dots }, "*");
    }
  }, [dots]);

  // ========== COMPUTE DISPLAY STATE ==========
  const showVideo = isHost ? isBroadcasting : hasStream;
  const showWaiting = isHost ? !isBroadcasting : !hasStream;

  // ========== ERROR STATE ==========
  if (error) {
    return (
      <div className="room-container">
        <div className="room-header">
          <div className="room-header-left">
            <Link href="/" className="back-link">
              ← Ana Sayfa
            </Link>
          </div>
        </div>
        <div className="screen-area">
          <div className="waiting-state">
            <div className="waiting-icon">⚠️</div>
            <h2 className="waiting-title">Hata</h2>
            <p className="waiting-subtitle">{error}</p>
            <Link
              href="/"
              className="btn btn-primary"
              style={{ marginTop: "1rem" }}
            >
              Ana Sayfaya Dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="room-container">
      {/* Header */}
      <div className="room-header">
        <div className="room-header-left">
          <Link href="/" className="back-link">
            ← Ana Sayfa
          </Link>
          <div
            className="room-id-badge"
            onClick={copyRoomId}
            title="Kopyalamak için tıkla"
          >
            🔑 {roomId}
          </div>
          <div className="room-status">
            <span
              className="status-dot"
              style={{
                background: isConnected ? "var(--success)" : "var(--danger)",
              }}
            />
            {isConnected ? (isHost ? "Yayıncı" : "İzleyici") : "Bağlanıyor..."}
          </div>
        </div>
        <div className="room-header-right">
          {isHost && (
            <div className="viewer-count">👥 {viewerCount} izleyici</div>
          )}
          {isHost && isBroadcasting && (
            <>
              <button
                className="btn btn-secondary"
                onClick={clearDots}
                style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
              >
                🗑️ Noktaları Temizle
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="screen-area">
        {/* Yayın başlatma ekranı (sadece host) */}
        {isHost && showWaiting && (
          <div className="broadcast-start">
            <div className="broadcast-start-icon">📡</div>
            <h2 className="waiting-title">Yayın Başlat</h2>
            <p className="waiting-subtitle">
              Ekranını paylaşmaya başla. İzleyiciler oda ID&apos;si ile
              katılabilir:
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                marginTop: "0.25rem",
              }}
            >
              <div
                className="room-id-badge"
                onClick={copyRoomId}
                style={{ fontSize: "1.1rem", padding: "0.5rem 1rem" }}
              >
                🔑 {roomId}
              </div>
            </div>
            <div className="share-btn-group">
              <button className="btn btn-primary" onClick={startBroadcast}>
                🖥️ Ekranı Paylaş
              </button>
              <button className="btn btn-secondary" onClick={copyRoomId}>
                📋 ID Kopyala
              </button>
            </div>
          </div>
        )}

        {/* İzleyici bekleme ekranı */}
        {!isHost && showWaiting && (
          <div className="waiting-state">
            <div className="waiting-icon">⏳</div>
            <h2 className="waiting-title">Yayın Bekleniyor</h2>
            <p className="waiting-subtitle">
              Yayıncının ekranını paylaşmasını bekliyoruz. Bağlantınız
              kurulduğunda yayın otomatik başlayacak.
            </p>
          </div>
        )}

        {/* VIDEO - her zaman render edilir ama showVideo false iken gizlenir */}
        <div
          className="video-wrapper"
          ref={videoWrapperRef}
          style={{ display: showVideo ? "flex" : "none" }}
          onClick={!isHost ? handleCanvasClick : undefined}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isHost}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
          {/* Dot canvas - video içerik alanına tam oturacak şekilde pozisyonlanır */}
          {videoContentRect && (
            <div
              className={`dot-canvas ${!isHost ? "interactive" : ""}`}
              style={{
                left: `${videoContentRect.offsetX}px`,
                top: `${videoContentRect.offsetY}px`,
                width: `${videoContentRect.width}px`,
                height: `${videoContentRect.height}px`,
              }}
            >
              {dots.map((dot) => (
                <div
                  key={dot.id}
                  className="dot-marker"
                  style={{
                    left: `${dot.x}%`,
                    top: `${dot.y}%`,
                    backgroundColor: dot.color,
                    color: dot.color,
                  }}
                >
                  <div className="dot-ring" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <footer
        style={{
          textAlign: "center",
          padding: "1rem",
          color: "var(--text-muted)",
          fontSize: "0.8rem",
          marginTop: "auto",
        }}
      >
        WOS Trick &copy; {new Date().getFullYear()}
      </footer>

      {/* Viewer Color Picker Toolbar */}
      {!isHost && hasStream && (
        <div className="toolbar">
          {COLORS.map((color) => (
            <div
              key={color}
              className={`color-option ${selectedColor === color ? "active" : ""}`}
              style={{ backgroundColor: color, color: color }}
              onClick={() => setSelectedColor(color)}
              title={color}
            />
          ))}
          <div className="toolbar-divider" />
          <div className="toolbar-divider" />
          <button
            className="btn btn-danger"
            onClick={clearDots}
            style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
          >
            🗑️ Remove
          </button>
        </div>
      )}

      {copied && <div className="copied-feedback">✅ Oda ID kopyalandı!</div>}
    </div>
  );
}
