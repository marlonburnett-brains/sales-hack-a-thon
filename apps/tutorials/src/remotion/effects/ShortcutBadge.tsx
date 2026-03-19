import React from "react";

type ShortcutBadgeProps = {
  shortcut: string;
};

export const ShortcutBadge: React.FC<ShortcutBadgeProps> = ({ shortcut }) => {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "10px 14px",
        borderRadius: 16,
        backgroundColor: "rgba(15, 23, 42, 0.82)",
        color: "#FFFFFF",
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: 24,
        fontWeight: 600,
        lineHeight: 1,
        letterSpacing: "0.03em",
        boxShadow: "0 14px 30px rgba(15, 23, 42, 0.24)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
      }}
    >
      {shortcut}
    </div>
  );
};
