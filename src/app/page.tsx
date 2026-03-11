"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

export default function HomePage() {
  const router = useRouter();
  const [joinRoomId, setJoinRoomId] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [hostPassword, setHostPassword] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateRoom = () => {
    if (!hostPassword.trim()) return;
    setIsCreating(true);
    const roomId = uuidv4().slice(0, 8).toUpperCase();
    // Şifreyi URL-safe base64 ile encode edip query parameter olarak gönder
    const encodedPassword = encodeURIComponent(hostPassword.trim());
    router.push(`/room/${roomId}?role=host&pwd=${encodedPassword}`);
  };

  const handleJoinRoom = () => {
    if (!joinRoomId.trim() || !joinPassword.trim()) return;
    const encodedPassword = encodeURIComponent(joinPassword.trim());
    router.push(
      `/room/${joinRoomId.trim().toUpperCase()}?role=viewer&pwd=${encodedPassword}`
    );
  };

  return (
    <div className="home-container">
      <div className="hero-section">
        <h1 className="hero-title">DotCast</h1>
        <p className="hero-subtitle">
          Share your screen, and let viewers place colorful dots on it.
          Real-time, fun, and interactive.
        </p>
      </div>

      <div className="cards-container">
        {/* Create Room */}
        <div className="action-card">
          <div className="card-icon">📡</div>
          <h2 className="card-title">Start Broadcast</h2>
          <p className="card-description">
            Create a new room and start sharing your screen. Share the Room ID
            with your viewers.
          </p>
          <div className="input-group">
            <input
              type="password"
              className="text-input"
              placeholder="Set a room password..."
              value={hostPassword}
              onChange={(e) => setHostPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
            />
            <button
              className="btn btn-primary btn-full"
              onClick={handleCreateRoom}
              disabled={isCreating || !hostPassword.trim()}
            >
              {isCreating ? "Creating..." : "🚀 Create Room"}
            </button>
            <p className="ip-warning" style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center", marginTop: "0.5rem", marginBottom: 0 }}>
              By creating a room, you acknowledge that your IP address will be recorded for security purposes.
            </p>
          </div>
        </div>

        {/* Join Room */}
        <div className="action-card">
          <div className="card-icon">👀</div>
          <h2 className="card-title">Watch Broadcast</h2>
          <p className="card-description">
            Join a room using the Room ID and Password. Place colorful dots on the screen.
          </p>
          <div className="input-group">
            <input
              type="text"
              className="text-input"
              placeholder="Enter Room ID..."
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
              maxLength={8}
            />
            <input
              type="password"
              className="text-input"
              placeholder="Room password..."
              value={joinPassword}
              onChange={(e) => setJoinPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
            />
            <button
              className="btn btn-secondary btn-full"
              onClick={handleJoinRoom}
              disabled={!joinRoomId.trim() || !joinPassword.trim()}
            >
              👁️ Join Room
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
