import {
  createLink,
  findByShortCode,
} from "@/server/repositories/link-repository";

function generateShortCode(): string {
  return Math.random().toString(36).slice(2, 8);
}

export async function generateUniqueLink(targetUrl: string, title?: string) {
  while (true) {
    const newcode = generateShortCode();
    const existing = await findByShortCode(newcode);
    if (!existing) {
      return createLink({ shortCode: newcode, targetUrl, title });
    }
  }
}
