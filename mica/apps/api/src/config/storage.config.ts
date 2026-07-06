import { registerAs } from "@nestjs/config";

export default registerAs("storage", () => ({
  driver: process.env.STORAGE_DRIVER ?? "local",
  local: {
    root: process.env.STORAGE_LOCAL_ROOT ?? "./storage",
  },
  s3: {
    bucket: process.env.STORAGE_S3_BUCKET,
    region: process.env.STORAGE_S3_REGION,
    accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY,
    endpoint: process.env.STORAGE_S3_ENDPOINT || undefined,
  },
}));
