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
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyWallet = () => {
    navigator.clipboard.writeText("0xfa5103beb35575abaa8a06af51743f18b7b27c6b");
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

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
      `/room/${joinRoomId.trim().toUpperCase()}?role=viewer&pwd=${encodedPassword}`,
    );
  };

  return (
    <div className="home-container">
      <div className="hero-section">
        <h1 className="hero-title">Whiteout Survival</h1>
        <p className="hero-subtitle">Dreamscape Memory Event Tool</p>
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
            <p
              className="ip-warning"
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                textAlign: "center",
                marginTop: "0.5rem",
                marginBottom: 0,
              }}
            >
              By creating a room, you acknowledge that your IP address will be
              recorded for security purposes.
            </p>
          </div>
        </div>

        {/* Join Room */}
        <div className="action-card">
          <div className="card-icon">👀</div>
          <h2 className="card-title">Watch Broadcast</h2>
          <p className="card-description">
            Join a room using the Room ID and Password. Place colorful dots on
            the screen.
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

      {/* Footer / GitHub Link */}
      <footer
        style={{
          marginTop: "4rem",
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: "0.875rem",
          paddingBottom: "2rem",
        }}
      >
        <p>
          <a
            href="https://github.com/melihogul/wos-dreamscape"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              color: "white",
              textDecoration: "none",
              fontWeight: "bold",
              background: "#333",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              transition: "background 0.2s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#555")}
            onMouseOut={(e) => (e.currentTarget.style.background = "#333")}
          >
            <svg
              height="20"
              width="20"
              aria-hidden="true"
              viewBox="0 0 16 16"
              version="1.1"
              fill="currentColor"
            >
              <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.46-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"></path>
            </svg>
            View on GitHub
          </a>
        </p>
        <div style={{ marginTop: "1.5rem" }}>
          <p style={{ marginBottom: "0.5rem" }}>Support the project (Donations accepted):</p>
          <div 
            onClick={handleCopyWallet}
            style={{ 
              display: "inline-block",
              background: "rgba(255, 255, 255, 0.1)", 
              padding: "0.4rem 0.8rem", 
              borderRadius: "0.25rem", 
              cursor: "pointer",
              fontFamily: "monospace",
              position: "relative",
              transition: "background 0.2s"
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)")}
            onMouseOut={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)")}
            title="Click to copy"
          >
            {isCopied ? "Copied!" : "0xfa5103beb35575abaa8a06af51743f18b7b27c6b"}
          </div>
        </div>
      </footer>
    </div>
  );
}
