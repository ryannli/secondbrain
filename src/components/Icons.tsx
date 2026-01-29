import {
  Youtube,
  Headphones,
  FileText,
  File,
  ExternalLink,
} from "lucide-react";
import { SourceType } from "@/lib/types";

// Logo component
export function Logo({ className, color }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className}>
      <circle cx="32" cy="32" r="28" fill={color || "currentColor"} opacity="0.25"/>
      <circle cx="32" cy="32" r="20" fill={color || "currentColor"} opacity="0.4"/>
      <circle cx="32" cy="32" r="12" fill={color || "currentColor"} opacity="0.6"/>
      <circle cx="32" cy="32" r="5" fill={color || "currentColor"}/>
    </svg>
  );
}

// Fallback icon based on source type (when no brand match)
export function getFallbackIcon(type: SourceType) {
  switch (type) {
    case "youtube":
      return Youtube;
    case "podcast":
      return Headphones;
    case "pdf":
      return File;
    case "note":
      return FileText;
    case "twitter":
    case "article":
    default:
      return ExternalLink;
  }
}
