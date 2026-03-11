"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

export default function HomePage() {
  const router = useRouter();
  const [joinRoomId, setJoinRoomId] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateRoom = () => {
    setIsCreating(true);
    const roomId = uuidv4().slice(0, 8).toUpperCase();
    router.push(`/room/${roomId}?role=host`);
  };

  const handleJoinRoom = () => {
    if (!joinRoomId.trim()) return;
    router.push(`/room/${joinRoomId.trim().toUpperCase()}?role=viewer`);
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
          <button
            className="btn btn-primary btn-full"
            onClick={handleCreateRoom}
            disabled={isCreating}
          >
            {isCreating ? "Oluşturuluyor..." : "🚀 Oda Oluştur"}
          </button>
        </div>

        {/* Odaya Katıl */}
        <div className="action-card">
          <div className="card-icon">👀</div>
          <h2 className="card-title">Yayın İzle</h2>
          <p className="card-description">
            Bir oda ID&apos;si girerek yayına katıl. Ekrana renkli noktalar
            koyarak işaret at.
          </p>
          <div className="input-group">
            <input
              type="text"
              className="text-input"
              placeholder="Oda ID'sini gir..."
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
              maxLength={8}
            />
            <button
              className="btn btn-secondary btn-full"
              onClick={handleJoinRoom}
              disabled={!joinRoomId.trim()}
            >
              👁️ Yayına Katıl
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
