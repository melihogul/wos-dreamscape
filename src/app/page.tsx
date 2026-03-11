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
          Ekranını paylaş, izleyicilerin renkli noktalarla ekranına işaret atsın.
          Gerçek zamanlı, eğlenceli, interaktif.
        </p>
      </div>

      <div className="cards-container">
        {/* Oda Oluştur */}
        <div className="action-card">
          <div className="card-icon">📡</div>
          <h2 className="card-title">Yayın Başlat</h2>
          <p className="card-description">
            Yeni bir oda oluştur ve ekranını paylaşmaya başla. Oda ID&apos;sini
            izleyicilerle paylaş.
          </p>
          <div className="input-group">
            <input
              type="password"
              className="text-input"
              placeholder="Oda şifresi belirle..."
              value={hostPassword}
              onChange={(e) => setHostPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
            />
            <button
              className="btn btn-primary btn-full"
              onClick={handleCreateRoom}
              disabled={isCreating || !hostPassword.trim()}
            >
              {isCreating ? "Oluşturuluyor..." : "🚀 Oda Oluştur"}
            </button>
          </div>
        </div>

        {/* Odaya Katıl */}
        <div className="action-card">
          <div className="card-icon">👀</div>
          <h2 className="card-title">Yayın İzle</h2>
          <p className="card-description">
            Bir oda ID&apos;si ve şifresi girerek yayına katıl. Ekrana renkli
            noktalar koyarak işaret at.
          </p>
          <div className="input-group">
            <input
              type="text"
              className="text-input"
              placeholder="Oda ID'sini gir..."
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
              maxLength={8}
            />
            <input
              type="password"
              className="text-input"
              placeholder="Oda şifresi..."
              value={joinPassword}
              onChange={(e) => setJoinPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
            />
            <button
              className="btn btn-secondary btn-full"
              onClick={handleJoinRoom}
              disabled={!joinRoomId.trim() || !joinPassword.trim()}
            >
              👁️ Yayına Katıl
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
