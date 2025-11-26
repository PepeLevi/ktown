import React, { useEffect, useRef, useState } from "react";

const media = [
  { type: "image", src: "/presentation/cyrus.jpg" },
  { type: "video", src: "/presentation/videotest.mp4" },
  { type: "image", src: "/presentation/cyrus.jpg" },
  { type: "video", src: "/presentation/videotest.mp4" },
  { type: "image", src: "/presentation/cyrus.jpg" },
];

export default function MediaPopupSequence({
  popupWidth = 600,
  popupHeight = 600,
}) {
  const [currentIndex, setCurrentIndex] = useState(-1); // -1 = none selected
  const [popup, setPopup] = useState(null); // { index, left, top } or null

  const getRandomPosition = () => {
    if (typeof window === "undefined") {
      return { left: 0, top: 0 };
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const maxLeft = Math.max(0, vw - popupWidth);
    const maxTop = Math.max(0, vh - popupHeight);

    const left = Math.floor(Math.random() * (maxLeft + 1));
    const top = Math.floor(Math.random() * (maxTop + 1));

    return { left, top };
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!media || media.length === 0) return;
      if (e.repeat) return; // avoid key auto-repeat

      // Forward: B key
      if (e.key === "b" || e.key === "B") {
        setCurrentIndex((prev) => {
          const lastIndex = media.length - 1;

          // If we're already at the last media, close and reset
          if (prev >= lastIndex) {
            setPopup(null);
            return -1;
          }

          const nextIndex = prev + 1;
          const pos = getRandomPosition();
          setPopup({ index: nextIndex, left: pos.left, top: pos.top });

          return nextIndex;
        });
      }

      // Backward: A key
      if (e.key === "a" || e.key === "A") {
        setCurrentIndex((prev) => {
          if (prev <= 0) return prev; // can't go back before first

          const nextIndex = prev - 1;
          const pos = getRandomPosition();
          setPopup({ index: nextIndex, left: pos.left, top: pos.top });

          return nextIndex;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [media, popupWidth, popupHeight]);

  if (!popup || popup.index < 0 || popup.index >= media.length) {
    return null;
  }

  const item = media[popup.index];

  return (
    <div
      style={{
        position: "fixed",
        left: popup.left,
        top: popup.top,
        width: popupWidth,
        height: popupHeight,

        overflow: "hidden",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {item.type === "image" ? (
        <img
          src={item.src}
          alt=""
          style={{
            maxWidth: "100%",
            height: "100%",
            objectFit: "contain",
            border: "1px solid var(--primary-color)",
          }}
        />
      ) : (
        <video
          src={item.src}
          autoPlay
          controls
          style={{
            border: "1px solid var(--primary-color)",
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
          }}
        />
      )}
    </div>
  );
}
