import { NextResponse } from "next/server";
import { listApplications, saveApplication } from "@/lib/db/repositories";
import type { Application } from "@/lib/marketplace";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const applications = await listApplications({
      campaignId: searchParams.get("campaignId") || undefined,
      creatorHandle: searchParams.get("creatorHandle") || undefined
    });
    return NextResponse.json({ applications });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { application?: Application };
    const application = body.application;
    if (!application?.id || !application.campaignId || !application.creatorHandle) {
      return NextResponse.json({ error: "id, campaignId and creatorHandle are required." }, { status: 400 });
    }
    return NextResponse.json({ application: await saveApplication(application) });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 500 });
  }
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected database error.";
}
