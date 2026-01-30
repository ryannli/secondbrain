import {
  Globe,
  FileText,
  Image,
} from "lucide-react";
import { SourceType } from "@/lib/types";

// PDF icon - document with red folded corner and "PDF" text
export function PDFIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style}>
      {/* Document body */}
      <path
        fill="#FECACA"
        d="M6 2C4.9 2 4 2.9 4 4v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6H6z"
      />
      {/* Folded corner */}
      <path
        fill="#DC2626"
        d="M14 2v6h6l-6-6z"
      />
      {/* PDF text */}
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fill="#DC2626"
        fontSize="6"
        fontWeight="bold"
        fontFamily="system-ui, sans-serif"
      >
        PDF
      </text>
    </svg>
  );
}

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
      return PDFIcon;    // PDF icon (red)
    case "image":
      return Image;      // Image file
    default:
      return Globe;
  }
}
