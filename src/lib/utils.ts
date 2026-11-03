import { t } from "./i18n";

export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return t("time.justNow");
  if (diffMins < 60) return t("time.minutes", { n: diffMins });
  if (diffHours < 24) return t("time.hours", { n: diffHours });
  return t("time.days", { n: diffDays });
}
