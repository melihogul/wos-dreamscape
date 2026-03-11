"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Dot } from "@/types";
import { io } from "socket.io-client";

export default function PopoutPage() {
  const params = useParams();
  const roomId = (params.id as string).toUpperCase();
  const [dots, setDots] = useState<Dot[]>([]);
  const [hasStream, setHasStream] = useState(false);
  const [videoContentRect, setVideoContentRect] = useState<{
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanedUpRef = useRef(false);

  // ========== VIDEO İÇERİK ALANI HESAPLAMA ==========
  const calculateVideoContentRect = useCallback(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container || !video.videoWidth || !video.videoHeight) return;

    const containerRect = container.getBoundingClientRect();
    const containerW = containerRect.width;
    const containerH = containerRect.height;

    const videoAspect = video.videoWidth / video.videoHeight;
    const containerAspect = containerW / containerH;

    let renderedW: number, renderedH: number, offsetX: number, offsetY: number;

    if (containerAspect > videoAspect) {
      renderedH = containerH;
      renderedW = containerH * videoAspect;
      offsetX = (containerW - renderedW) / 2;
      offsetY = 0;
    } else {
      renderedW = containerW;
      renderedH = containerW / videoAspect;
      offsetX = 0;
      offsetY = (containerH - renderedH) / 2;
    }

    setVideoContentRect({ offsetX, offsetY, width: renderedW, height: renderedH });
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleResize = () => calculateVideoContentRect();
    video.addEventListener("loadedmetadata", handleResize);
    video.addEventListener("play", handleResize);
    video.addEventListener("resize", handleResize);
    window.addEventListener("resize", handleResize);

    if (video.videoWidth && video.videoHeight) {
      calculateVideoContentRect();
    }

    return () => {
      video.removeEventListener("loadedmetadata", handleResize);
      video.removeEventListener("play", handleResize);
      video.removeEventListener("resize", handleResize);
      window.removeEventListener("resize", handleResize);
    };
  }, [calculateVideoContentRect, hasStream]);

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

    let peerConnection: RTCPeerConnection | null = null;

    socket.on("connect", () => {
      socket.emit("join-room", roomId, (data: { success: boolean; dots?: Dot[]; hostSocketId?: string }) => {
        if (data.success && data.dots) {
          setDots(data.dots);
        }
      });
    });

    socket.on("dot-added", (dot: Dot) => {
      setDots((prev) => [...prev, dot]);
    });

    socket.on("dots-cleared", () => {
      setDots([]);
    });

    socket.on("room-closed", () => {
      window.close();
    });

    socket.on("webrtc-offer", async (data: { offer: RTCSessionDescriptionInit; fromSocketId: string }) => {
      try {
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        });
        peerConnection = pc;

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("webrtc-ice-candidate", {
              targetSocketId: data.fromSocketId,
              candidate: event.candidate.toJSON(),
            });
          }
        };

        pc.ontrack = (event) => {
          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
            videoRef.current.play().catch(console.error);
            setHasStream(true);
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("webrtc-answer", {
          targetSocketId: data.fromSocketId,
          answer: answer,
        });
      } catch (err) {
        console.error("Popout WebRTC error:", err);
      }
    });

    socket.on("webrtc-ice-candidate", (iceData: { candidate: RTCIceCandidateInit; fromSocketId: string }) => {
      if (peerConnection) {
        peerConnection.addIceCandidate(new RTCIceCandidate(iceData.candidate)).catch(console.error);
      }
    });

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "dots-update") {
        setDots(e.data.dots);
      }
    };
    window.addEventListener("message", handleMessage);

    if (window.opener) {
      window.opener.postMessage({ type: "popout-ready" }, "*");
    }

    return () => {
      cleanedUpRef.current = true;
      window.removeEventListener("message", handleMessage);
      if (peerConnection) peerConnection.close();
      socket.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="popout-container" ref={containerRef}>
      {!hasStream ? (
        <div className="waiting-state" style={{ color: "#fff" }}>
          <div className="waiting-icon">📺</div>
          <h2 className="waiting-title">Yayına bağlanılıyor...</h2>
          <p className="waiting-subtitle" style={{ color: "#888" }}>
            Yayın akışı alınıyor, lütfen bekleyin.
          </p>
        </div>
      ) : (
        <>
          <video ref={videoRef} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          {videoContentRect && (
            <div
              className="popout-dot-canvas"
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
        </>
      )}
    </div>
  );
}
