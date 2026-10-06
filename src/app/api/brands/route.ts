import { NextResponse } from "next/server";
import { getBrand, saveBrand } from "@/lib/db/repositories";
import { slug } from "@/lib/marketplace";
import type { BusinessProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Load one brand's saved profile by its slug id (or ?name=). */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = (searchParams.get("id") || (searchParams.get("name") ? slug(searchParams.get("name")!) : "")).trim();
    if (!id) return NextResponse.json({ error: "id or name is required." }, { status: 400 });
    return NextResponse.json({ brand: await getBrand(id) });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 500 });
  }
}

/** Persist a brand profile so it survives reloads and shows on every device. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { profile?: BusinessProfile; id?: string };
    const profile = body.profile;
    if (!profile?.businessName) return NextResponse.json({ error: "profile.businessName is required." }, { status: 400 });
    const id = (body.id || slug(profile.businessName)).trim();
    await saveBrand(profile, id);
    return NextResponse.json({ id, brand: profile });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 500 });
  }
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected database error.";
}
