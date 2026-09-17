import { NextRequest, NextResponse } from "next/server";
import { integrationRetryQueue } from "@/modules/integrations/core/retry-queue";

export async function GET(req: NextRequest) {
  const tenantId = req.headers.get("x-tenant-id") || undefined;
  const deadLetters = integrationRetryQueue.getDeadLetters(tenantId);
  return NextResponse.json({
    success: true,
    count: deadLetters.length,
    deadLetters,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { deadLetterId } = body;

    if (!deadLetterId) {
      return NextResponse.json(
        { error: "Missing deadLetterId in request body" },
        { status: 400 }
      );
    }

    const result = await integrationRetryQueue.replayDeadLetter(
      deadLetterId,
      async (payload) => {
        // Generic replay simulation
        return true;
      }
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({ success: true, replayed: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to replay dead letter" },
      { status: 500 }
    );
  }
}
