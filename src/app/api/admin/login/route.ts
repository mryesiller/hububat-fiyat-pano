import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const ADMIN_USERNAME = "ADMIN";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return NextResponse.json(
        { error: "Admin authentication not configured" },
        { status: 500 }
      );
    }

    if (username !== ADMIN_USERNAME || password !== adminPassword) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Generate a simple token (valid for 24 hours)
    const timestamp = Date.now();
    const tokenData = `${ADMIN_USERNAME}:${timestamp}:${adminPassword}`;
    const token = crypto.createHash("sha256").update(tokenData).digest("hex");

    return NextResponse.json({
      success: true,
      token,
      expiresAt: timestamp + 24 * 60 * 60 * 1000, // 24 hours
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
