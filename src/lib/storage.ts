import { createHash, createHmac } from "node:crypto";
import { mkdir, readFile, writeFile, access, mkdtemp } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const driver = process.env.STORAGE_DRIVER || "local";
const root = path.resolve(process.cwd(), process.env.STORAGE_ROOT || "./storage");

function keyFor(rel: string) {
  return rel.replace(/\\/g, "/").replace(/^\/+/, "");
}

function localTarget(rel: string) {
  const target = path.resolve(root, rel);
  if (!target.startsWith(root)) throw new Error("Invalid storage path");
  return target;
}

function s3Config() {
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const accessKey = process.env.S3_ACCESS_KEY_ID;
  const secretKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKey || !secretKey) {
    throw new Error("S3 storage is selected but S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID or S3_SECRET_ACCESS_KEY is missing");
  }
  return { endpoint: endpoint.replace(/\/$/, ""), bucket, accessKey, secretKey, region: process.env.S3_REGION || "us-east-1" };
}

function signV4(method: string, url: URL, body: Buffer, cfg: ReturnType<typeof s3Config>) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = createHash("sha256").update(body).digest("hex");
  const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [method, url.pathname, url.searchParams.toString(), canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
  const kDate = createHmac("sha256", `AWS4${cfg.secretKey}`).update(dateStamp).digest();
  const kRegion = createHmac("sha256", kDate).update(cfg.region).digest();
  const kService = createHmac("sha256", kRegion).update("s3").digest();
  const kSigning = createHmac("sha256", kService).update("aws4_request").digest();
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  return {
    Authorization: `AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
}

function s3Url(rel: string) {
  const cfg = s3Config();
  const encoded = keyFor(rel).split("/").map(encodeURIComponent).join("/");
  return new URL(`${cfg.endpoint}/${cfg.bucket}/${encoded}`);
}

export const storage = {
  driver,
  root,

  async write(rel: string, data: Buffer | Uint8Array) {
    const body = Buffer.from(data);
    if (driver === "local") {
      const target = localTarget(rel);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, body);
      return;
    }
    const url = s3Url(rel);
    const res = await fetch(url, { method: "PUT", headers: signV4("PUT", url, body, s3Config()), body });
    if (!res.ok) throw new Error(`S3 upload failed: ${res.status} ${await res.text()}`);
  },

  async read(rel: string) {
    if (driver === "local") return readFile(localTarget(rel));
    const url = s3Url(rel);
    const res = await fetch(url, { headers: signV4("GET", url, Buffer.alloc(0), s3Config()) });
    if (!res.ok) throw new Error(`S3 download failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  },

  async exists(rel: string) {
    try {
      if (driver === "local") {
        await access(localTarget(rel));
        return true;
      }
      const url = s3Url(rel);
      const res = await fetch(url, { method: "HEAD", headers: signV4("HEAD", url, Buffer.alloc(0), s3Config()) });
      return res.ok;
    } catch {
      return false;
    }
  },

  async localPath(rel: string) {
    if (driver === "local") return localTarget(rel);
    const cacheDir = await mkdtemp(path.join(os.tmpdir(), "clipforge-"));
    const target = path.join(cacheDir, path.basename(rel));
    await writeFile(target, await storage.read(rel));
    return target;
  },

  async tempDir(prefix = "clipforge-") {
    return mkdtemp(path.join(os.tmpdir(), prefix));
  },
};
