import {
  Globe,
  FileText,
  File,
  Image,
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

/**
 * Fallback icon based on source type (when no brand match from URL)
 * Type now represents file format, not content source:
 * - html: Web pages (brand is detected from source_url)
 * - text: Plain text notes
 * - document: PDF, DOC, etc.
 * - image: PNG, JPG, etc.
 */
export function getFallbackIcon(type: SourceType) {
  switch (type) {
    case "html":
      return Globe;      // Generic web page
    case "text":
      return FileText;   // Plain text note
    case "document":
      return File;       // PDF, DOC, etc.
    case "image":
      return Image;      // Image file
    default:
      return Globe;
  }
}
