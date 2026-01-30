import { SourceType } from "@/lib/types";
import { getBrandFromUrl } from "@/lib/brandLogos";
import { getFallbackIcon } from "@/components/Icons";

/**
 * Get icon component and color for a source
 * Priority: brand logo (from URL) > fallback icon (from type)
 */
export function getSourceIcon(
  sourceUrl: string | undefined,
  type: SourceType = "html",
  accentColor: string
): {
  Icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  isBrand: boolean;
} {
  const brand = getBrandFromUrl(sourceUrl);
  if (brand) {
    return { Icon: brand.Logo, color: brand.color, isBrand: true };
  }
  return { Icon: getFallbackIcon(type), color: accentColor, isBrand: false };
}
