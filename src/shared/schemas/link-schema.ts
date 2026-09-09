import { z } from "zod";

export const createLinkSchema = z.object({
  targetUrl: z.url(),
  title: z.string().optional(),
});

export const updateLinkSchema = z.object({
  isActive: z.boolean(),
});
