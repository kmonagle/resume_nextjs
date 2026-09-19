// Why this file exists: the form-facing write path. Server Actions let a
// <form> (and useTransition) call server code directly, with no hand-written
// fetch or API route; Next handles the POST, serialisation and CSRF checks.
// They are thin: validate, resolve the visitor, delegate to the LinkApi.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getLinkApi } from "@/server/link-api";
import { getOrCreateVisitorId, readVisitorId } from "@/server/visitor";
import { createLinkSchema } from "@/shared/schemas/link-schema";

const FIELDS = ["targetUrl", "title", "expiresAt", "maxClicks", "shortCode"];

// A discriminated union: `status` tells TypeScript which other fields exist,
// so the form can only read `shortCode` after checking for "success".
export type CreateLinkState =
  | { status: "idle" }
  | {
      status: "error";
      error?: string;
      fieldErrors: Record<string, string[] | undefined>;
      // React 19 resets uncontrolled forms after every action, so we echo what
      // the user typed back to repopulate the fields.
      values: Record<string, string>;
    }
  | { status: "success"; shortCode: string };

export async function createLinkAction(
  _prevState: CreateLinkState,
  formData: FormData,
): Promise<CreateLinkState> {
  // Untrusted input: FormData values are strings or files, so read defensively.
  const values: Record<string, string> = {};
  for (const field of FIELDS) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value : "";
  }

  const parsed = createLinkSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values,
    };
  }

  const ownerId = await getOrCreateVisitorId();
  const result = await getLinkApi().createLink(ownerId, parsed.data);

  switch (result.status) {
    case "created":
      // Two separate caches exist: Next's server/router cache (cleared here)
      // and react-query's browser cache (cleared by the form component).
      revalidatePath("/dashboard");
      return { status: "success", shortCode: result.link.shortCode };
    case "code_taken":
      return {
        status: "error",
        fieldErrors: { shortCode: ["That code is already taken"] },
        values,
      };
    case "limit_reached":
      return {
        status: "error",
        error: result.message,
        fieldErrors: {},
        values,
      };
  }
}

export type SetLinkActiveState =
  | { status: "success" }
  | { status: "error"; error: string };

export async function setLinkActiveAction(
  id: string,
  isActive: boolean,
): Promise<SetLinkActiveState> {
  // Server Actions are public HTTP endpoints; never trust the arguments.
  // Ownership is enforced in SQL (WHERE id AND owner_id), so another
  // visitor's id simply matches nothing.
  const ownerId = await readVisitorId();
  const link = ownerId
    ? await getLinkApi().setLinkActive(ownerId, id, isActive)
    : null;
  if (!link) {
    return { status: "error", error: "Link not found" };
  }
  revalidatePath("/dashboard");
  return { status: "success" };
}
