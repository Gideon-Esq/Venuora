import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { requireVenue } from "@/lib/tenancy";
import { IMAGE_TYPES, imageFormat, MAX_IMAGE_BYTES } from "@/lib/image-upload";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const json = (error: string, status: number) => Response.json({ error }, { status });
  // Browsers send Origin with file POSTs. Reject cross-site requests before reading bytes.
  if (request.headers.get("origin") !== new URL(request.url).origin) return json("Upload from this website only.", 403);
  const session = await auth();
  if (!session?.user?.id) return json("Please sign in before uploading.", 401);
  const { slug } = await params;
  const { venue } = await requireVenue(slug, "MANAGER");
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) return json("Image uploads are not configured yet. Ask the venue owner to contact support.", 503);
  const type = request.headers.get("content-type") ?? "";
  if (!IMAGE_TYPES.includes(type)) return json("Choose a JPG, PNG, WebP or GIF image.", 415);
  if (Number(request.headers.get("content-length")) > MAX_IMAGE_BYTES) return json("Choose an image smaller than 3 MB.", 413);
  if (!request.body) return json("Choose an image to upload.", 400);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_IMAGE_BYTES) {
        await reader.cancel();
        return json("Choose an image smaller than 3 MB.", 413);
      }
      chunks.push(value);
    }
  } catch {
    return json("The upload was interrupted. Please try again.", 400);
  } finally { reader.releaseLock(); }
  const bytes = Buffer.concat(chunks);
  const format = imageFormat(bytes);
  if (!format || format.type !== type) return json("This file is not a supported image. Export it as JPG, PNG, WebP or GIF.", 415);
  // Server-generated paths prevent user-selected overwrites and separate tenant assets.
  const pathname = `venues/${venue.id}/${randomUUID()}.${format.extension}`;
  try {
    // Vercel Blob PUT protocol (API v13), matching vercel/storage's put.ts and put-helpers.ts.
    // Native fetch preserves the project's no-new-dependencies convention.
    const response = await fetch(`https://vercel.com/api/blob/?${new URLSearchParams({ pathname })}`, {
      method: "PUT", body: bytes,
      headers: {
        authorization: `Bearer ${token}`,
        "x-api-version": "13",
        "x-vercel-blob-store-id": token.split("_")[3] ?? "",
        "x-vercel-blob-access": "public",
        "x-content-type": format.type,
        "content-type": format.type,
        "x-content-length": String(size),
        "x-add-random-suffix": "1",
        "x-allow-overwrite": "0",
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return json("We couldn’t store your image. Please try again or check the storage connection.", 502);
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("url" in data) || typeof data.url !== "string") return json("Storage returned an invalid response. Please try again.", 502);
    const url = new URL(data.url);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".public.blob.vercel-storage.com") || !url.pathname.startsWith(`/venues/${venue.id}/`)) return json("Storage returned an invalid image link.", 502);
    return Response.json({ url: url.href }, { status: 201 });
  } catch {
    return json("Your image could not be uploaded. Please try again.", 502);
  }
}
