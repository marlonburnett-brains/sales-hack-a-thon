"use client";

import { useEffect, useState } from "react";

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|;\\s*)" + name + "=([^;]*)")
  );
  return match ? decodeURIComponent(match[1]) : null;
}

export function GoogleTokenBadge() {
  const [showBadge, setShowBadge] = useState(false);

  useEffect(() => {
    const status = getCookieValue("google-token-status");
    // Show badge when cookie is "missing" or absent (null)
    setShowBadge(status !== "valid");
  }, []);

  if (!showBadge) return null;

  return (
    <span
      className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white"
      title="Google Drive not connected"
      aria-label="Google Drive not connected"
    />
  );
}
