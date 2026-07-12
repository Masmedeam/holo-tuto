import { Storage } from "@google-cloud/storage";
import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";

export async function publishVideo(filePath: string, jobId: string) {
  const bucketName = process.env.VIDEO_BUCKET;
  if (!bucketName) {
    const generated = path.join(process.cwd(), "public", "generated");
    await mkdir(generated, { recursive: true });
    const target = path.join(generated, `${jobId}.mp4`);
    await copyFile(filePath, target);
    return `/generated/${jobId}.mp4`;
  }

  const storage = new Storage();
  const objectName = `tutorials/${jobId}.mp4`;
  const bucket = storage.bucket(bucketName);
  await bucket.upload(filePath, {
    destination: objectName,
    resumable: false,
    metadata: {
      contentType: "video/mp4",
      cacheControl: "private, max-age=3600",
      metadata: { generatedBy: "holo-tutorial" }
    }
  });
  const [url] = await bucket.file(objectName).getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000
  });
  return url;
}
