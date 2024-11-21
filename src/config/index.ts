import "dotenv/config";

export const config = {
  PORT: process.env.PORT ?? 3008,
  privateKey: process.env.GOOGLE_PRIVATE_KEY ?? "",
  clientEmail: process.env.GOOGLE_CLIENT_EMAIL ?? "",
  sheetId: process.env.SHEET_ID ?? "",
  metaNumberId: process.env.META_NUMBER_ID ?? "",
  metaJwtToken: process.env.META_JWT_TOKEN ?? "",
  metaVerifyToken: process.env.META_VERIFY_TOKEN ?? "",
  metaVersion: process.env.META_VERSION ?? "",
};
