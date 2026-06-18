import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getCurrentRootPath } from "@/lib/storage";

function getTrackingDir(): string {
  return path.join(getCurrentRootPath(), ".tracking");
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * POST /api/tracking
 * Receives an array of tracking events, appends to daily JSONL file.
 */
export async function POST(request: NextRequest) {
  try {
    const events = await request.json();
    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ success: true, written: 0 });
    }

    const dir = getTrackingDir();
    await fs.mkdir(dir, { recursive: true });

    // Group events by date
    const byDate = new Map<string, string[]>();
    for (const event of events) {
      const date = event.t ? dateKey(new Date(event.t)) : dateKey(new Date());
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date)!.push(JSON.stringify(event));
    }

    // Append to per-day files
    for (const [date, lines] of byDate) {
      const filePath = path.join(dir, `${date}.jsonl`);
      await fs.appendFile(filePath, lines.join("\n") + "\n");
    }

    return NextResponse.json({ success: true, written: events.length });
  } catch (error) {
    console.error("Tracking write error:", error);
    return NextResponse.json({ success: true, written: 0 }); // Never fail client
  }
}

/**
 * GET /api/tracking?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns events for the given date range.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to") || from;

    if (!from) {
      return NextResponse.json({ success: false, error: "Missing 'from' parameter" }, { status: 400 });
    }

    const dir = getTrackingDir();
    const events: unknown[] = [];

    // Iterate dates in range
    const start = new Date(from + "T00:00:00Z");
    const end = new Date((to || from) + "T00:00:00Z");

    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const filePath = path.join(dir, `${dateKey(d)}.jsonl`);
      try {
        const content = await fs.readFile(filePath, "utf-8");
        for (const line of content.split("\n")) {
          if (line.trim()) {
            try { events.push(JSON.parse(line)); } catch { /* skip malformed */ }
          }
        }
      } catch {
        // File doesn't exist for this date — skip
      }
    }

    return NextResponse.json({ success: true, events });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
