import React from "react";
import logoImage from "@/assets/frete-facil-pro-logo.png";

interface LogoProps {
  variant?: "icon" | "horizontal" | "stacked";
  size?: "sm" | "md" | "lg" | "xl";
  light?: boolean;
  className?: string;
}

export function Logo({
  variant = "horizontal",
  size = "md",
  light = false,
  className = "",
}: LogoProps) {
  // Ajusta a altura da imagem dinamicamente com base na propriedade size
  const heightClass = {
    sm: "h-8 w-auto",
    md: "h-10 w-auto",
    lg: "h-48 w-auto",
    xl: "h-72 w-auto",
  }[size];

  return (
    <img
      src={logoImage}
      alt="Frete Fácil PRO"
      className={`${heightClass} object-contain transition-transform duration-200 hover:scale-102 shrink-0 ${className}`}
    />
  );
}
