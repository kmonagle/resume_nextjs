"use server";

import { generateUniqueLink } from "@/server/services/link-service";
import { setLinkActive } from "@/server/repositories/link-repository";
import { createLinkSchema } from "@/shared/schemas/link-schema";
import { revalidatePath } from "next/cache";

export type CreateLinkState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | { status: "success"; shortCode: string };

export async function createLinkAction(
  _prevState: CreateLinkState,
  formData: FormData,
): Promise<CreateLinkState> {
  const parsed = createLinkSchema.safeParse({
    targetUrl: formData.get("targetUrl"),
    title: formData.get("title") || undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues[0]?.message ?? "Invalid URL",
    };
  }

  const link = await generateUniqueLink(
    parsed.data.targetUrl,
    parsed.data.title,
  );
  revalidatePath("/dashboard");
  return { status: "success", shortCode: link.shortCode };
}

export type SetLinkActiveState =
  | { status: "success" }
  | { status: "error"; error: string };

export async function setLinkActiveAction(
  id: string,
  isActive: boolean,
): Promise<SetLinkActiveState> {
  const link = await setLinkActive(id, isActive);
  if (!link) {
    return { status: "error", error: "Link not found" };
  }
  revalidatePath("/dashboard");
  return { status: "success" };
}
