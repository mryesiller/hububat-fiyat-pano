import crypto from "crypto";

const ADMIN_USERNAME = "ADMIN";
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

export function verifyAdminToken(token: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;

  // Try different timestamps within last 24 hours
  const now = Date.now();
  for (let t = now; t >= now - TOKEN_EXPIRY; t -= 60000) { // Check every minute
    const expectedToken = crypto
      .createHash("sha256")
      .update(`${ADMIN_USERNAME}:${t}:${adminPassword}`)
      .digest("hex");
    if (token === expectedToken) return true;
  }

  return false;
}
