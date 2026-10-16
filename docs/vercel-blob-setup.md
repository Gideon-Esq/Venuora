# Venue image uploads with Vercel Blob

The app now accepts image files for venue logos, venue photos, and space photos. No database migration or additional package is needed. Existing hosted image links still work.

## Connect your store

1. Open your Venuora project in the Vercel dashboard.
2. Open **Storage**, choose **Create Database / Connect Store**, and select **Blob**. Choose a **public** store: these are images for your public venue pages, not private documents. Pick a suitable region and name, such as `venuora-images`.
3. Connect the store to Venuora. Include Production and Preview, plus Development if you want to upload locally. Confirm that the project has the server-side environment variable `BLOB_READ_WRITE_TOKEN`.
4. For local development, copy the store's read/write token into your local `.env`:

   ```dotenv
   BLOB_READ_WRITE_TOKEN="your-blob-read-write-token"
   ```

   Keep the token out of source control and browser code. Do not use a `NEXT_PUBLIC_` prefix or share the token in chat. If you already use the Vercel CLI, you can pull connected Development environment variables instead; avoid overwriting unrelated local database/auth settings.
5. Restart `npm run dev`. Redeploy the Vercel project so its deployment receives the new environment variable.

Vercel references: [server uploads](https://vercel.com/docs/vercel-blob/server-upload), [public Blob storage](https://vercel.com/docs/vercel-blob/public-storage).

## Try an upload

1. Sign in with owner access and open your venue's **Settings → Branding**.
2. Use **Upload logo** or **Upload photos**, select an image, and wait for the upload message.
3. Click **Save**. Open your public venue page and check the image.
4. Open a space's details (or create a space), upload photos, and save the space.
5. In Vercel Storage, the files should appear under `venues/<venue-id>/`. No application server filesystem storage is used.

JPG, PNG, WebP, and GIF are supported, up to 3 MiB per file, with up to 20 photos per venue or space. Larger images must be resized before uploading. SVG and HEIC uploads are not supported. Uploading runs one file at a time and reports partial success if a later file fails. Save and discard actions are blocked while uploads are in progress.

## Access and lifecycle

Only authenticated users authorized by `requireVenue(slug, "MANAGER")` can upload. The server generates a tenant-specific UUID pathname, checks file signatures against the declared content type, and enforces the byte limit even if content-length is missing or incorrect. The token stays server-side. Photos are publicly accessible as soon as uploaded, including before the venue is published or changes are saved; use this only for public marketing images.

Saving the existing branding/space forms attaches the uploaded URL to the venue or space. Removing a photo from a form removes its reference when saved; it does not permanently delete its Blob object. Replaced, discarded, or interrupted uploads may leave unreferenced objects. Review those in Vercel Storage and delete only files you have verified are unused. Automatic garbage collection and storage quotas are not implemented.

The project forbids new dependencies, so this implementation uses native server-side fetch with the Vercel Blob PUT protocol (API version 13), verified against Vercel's official storage source. It does not implement the full SDK or large direct-to-Blob browser uploads. The 3 MiB cap keeps requests below Vercel's function body limit. Recheck the protocol if Vercel changes its API.

## Verification

```bash
npx tsc --noEmit
npx vitest run --config vitest.uploads.config.ts
```

The focused tests mock authentication and storage and need no database. They cover tenant authorization, cross-origin requests, file types, signatures, size enforcement, upstream failures, and storage response validation. A real upload still needs the connected store and token; mocked tests do not verify your Vercel account configuration.
