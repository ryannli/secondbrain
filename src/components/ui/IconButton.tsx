"use client";

import React from "react";

interface IconButtonProps {
  onClick?: () => void;
  children: React.ReactNode;
  title?: string;
  disabled?: boolean;
  variant?: "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
  style?: React.CSSProperties;
}

const sizeClasses = {
  sm: "p-1",
  md: "p-1.5",
  lg: "p-2",
};

const variantClasses = {
  ghost: "hover:bg-black/5",
  outline: "border hover:bg-black/5",
};

export function IconButton({
  onClick,
  children,
  title,
  disabled = false,
  variant = "ghost",
  size = "md",
  className = "",
  style,
}: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        rounded-lg transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `.trim().replace(/\s+/g, " ")}
      style={style}
    >
      {children}
    </button>
  );
}
