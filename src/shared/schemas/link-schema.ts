// Why this file exists: request validation shared by the form's server action
// and the JSON API route, so the two entry points can never disagree about
// what a valid link is. Zod validates at the trust boundary (untrusted input);
// everything past this point can rely on the types.
import { z } from "zod";

// HTML forms send "" for an untouched field, not `undefined`. Normalise once so
// "optional" really means optional.
const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const createLinkSchema = z.object({
  // `z.url()` alone accepts ANY scheme, including `javascript:` and `data:`.
  // Restricting to http(s) stops the shortener redirecting to script URLs.
  targetUrl: z
    .url({ protocol: /^https?$/, error: "Enter a valid http(s) URL" })
    .max(2048),
  title: z.preprocess(blankToUndefined, z.string().trim().max(100).optional()),
  // ISO string with offset (the browser converts datetime-local before
  // sending, because the server does not know the user's timezone).
  expiresAt: z.preprocess(
    blankToUndefined,
    z.iso
      .datetime({ offset: true, error: "Enter a valid date and time" })
      .transform((value) => new Date(value))
      .refine((date) => date.getTime() > Date.now(), {
        error: "Expiry must be in the future",
      })
      .optional(),
  ),
  maxClicks: z.preprocess(
    blankToUndefined,
    z.coerce
      .number({ error: "Enter a whole number" })
      .int({ error: "Enter a whole number" })
      .min(1, { error: "Must be at least 1" })
      .max(1_000_000, { error: "Must be at most 1,000,000" })
      .optional(),
  ),
  shortCode: z.preprocess(
    blankToUndefined,
    z
      .string()
      .regex(/^[A-Za-z0-9_-]{3,32}$/, {
        error: "3-32 characters: letters, numbers, - and _",
      })
      .optional(),
  ),
});

export type CreateLinkInput = z.output<typeof createLinkSchema>;

export const updateLinkSchema = z.object({
  isActive: z.boolean(),
});
