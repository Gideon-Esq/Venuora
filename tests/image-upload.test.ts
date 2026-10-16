import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/tenancy", () => ({ requireVenue: vi.fn() }));
import { auth } from "@/lib/auth";
import { requireVenue } from "@/lib/tenancy";
import { POST } from "@/app/api/venues/[slug]/images/route";
import { MAX_IMAGE_BYTES } from "@/lib/image-upload";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/h8AAAAASUVORK5CYII=", "base64");
const context = { params: Promise.resolve({ slug: "my-venue" }) };
const fetchMock = vi.fn();
function request(body: Uint8Array = png, headers: Record<string, string> = {}) {
  return new Request("https://venuora.example/api/venues/my-venue/images", { method: "POST", headers: { origin: "https://venuora.example", "content-type": "image/png", ...headers }, body: Buffer.from(body) });
}

beforeEach(() => {
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_test_secret");
  vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
  vi.mocked(requireVenue).mockResolvedValue({ venue: { id: "venue-1" } } as never);
  fetchMock.mockImplementation(async (url: string) => Response.json({ url: `https://test.public.blob.vercel-storage.com/${new URL(url).searchParams.get("pathname")}` }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("venue image uploads", () => {
  it("stores an authenticated image under the authorized venue and keeps the token server-side", async () => {
    const response = await POST(request(), context);
    expect(response.status).toBe(201);
    expect(requireVenue).toHaveBeenCalledWith("my-venue", "MANAGER");
    const result = await response.json();
    expect(result.url).toMatch(/^https:\/\/test.public.blob.vercel-storage.com\/venues\/venue-1\/.+\.png$/);
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe("Bearer vercel_blob_rw_test_secret");
    expect(fetchMock.mock.calls[0][1].headers["x-allow-overwrite"]).toBe("0");
  });
  it("rejects cross-site uploads before authentication or storage", async () => {
    expect((await POST(request(png, { origin: "https://other.example" }), context)).status).toBe(403);
    expect(auth).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects unsigned uploads", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await POST(request(), context)).status).toBe(401);
    expect(requireVenue).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not upload when the tenant guard denies access", async () => {
    vi.mocked(requireVenue).mockRejectedValue(new Error("NEXT_NOT_FOUND"));
    await expect(POST(request(), context)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("reports an unconfigured store without exposing credentials", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    expect((await POST(request(), context)).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects HTML disguised as an image and SVG files", async () => {
    expect((await POST(request(Buffer.from("<html>not an image</html>")), context)).status).toBe(415);
    expect((await POST(request(png, { "content-type": "image/svg+xml" }), context)).status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects a valid signature sent with a different content type", async () => {
    expect((await POST(request(png, { "content-type": "image/jpeg" }), context)).status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("enforces size when content-length is absent or falsified", async () => {
    expect((await POST(request(new Uint8Array(MAX_IMAGE_BYTES + 1), { "content-length": "1" }), context)).status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects oversize declared requests without storing them", async () => {
    expect((await POST(request(png, { "content-length": String(MAX_IMAGE_BYTES + 1) }), context)).status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("handles storage failure without exposing upstream details", async () => {
    fetchMock.mockResolvedValue(new Response("secret upstream error", { status: 403 }));
    const response = await POST(request(), context);
    expect(response.status).toBe(502); expect(await response.text()).not.toContain("secret");
  });
  it("rejects an unexpected host or another venue's path in the storage response", async () => {
    for (const url of ["https://attacker.example/image.png", "https://test.public.blob.vercel-storage.com/venues/other/image.png"]) {
      fetchMock.mockResolvedValue(Response.json({ url }));
      expect((await POST(request(), context)).status).toBe(502);
    }
  });
});
