import { NextResponse } from "next/server";
import { deleteApplication, setApplicationStatus } from "@/lib/db/repositories";
import type { ApplicationStatus } from "@/lib/marketplace";

export const dynamic = "force-dynamic";

const STATUSES: ApplicationStatus[] = ["applied", "shortlisted", "approved", "rejected"];

/** Brand-side decision on one application. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { status?: ApplicationStatus; brandNote?: string };
    if (!body.status || !STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `status must be one of ${STATUSES.join(", ")}.` }, { status: 400 });
    }
    const application = await setApplicationStatus(id, body.status, body.brandNote);
    if (!application) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    return NextResponse.json({ application });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 500 });
  }
}

/** Creator withdrawing their application. */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await deleteApplication(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 500 });
  }
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected database error.";
}
