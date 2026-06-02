import { HttpError } from "../middleware/error.js";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new HttpError(503, "Chưa cấu hình dịch vụ gửi OTP.");
  }
  return value;
}

async function sendWithTwilio(phone: string, message: string) {
  const accountSid = requireEnv("TWILIO_ACCOUNT_SID");
  const authToken = requireEnv("TWILIO_AUTH_TOKEN");
  const from = requireEnv("TWILIO_FROM_PHONE");
  const body = new URLSearchParams({
    From: from,
    To: phone,
    Body: message
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    }
  );

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const providerMessage =
      typeof errorBody === "object" && errorBody && "message" in errorBody
        ? String(errorBody.message)
        : "SMS provider rejected the request.";
    throw new HttpError(502, providerMessage);
  }
}

export async function sendPhoneOtpSms(phone: string, otp: string) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[DEV OTP] ${phone}: ${otp}`);
    return;
  }

  const provider = process.env.SMS_PROVIDER?.trim().toLowerCase();
  const message = `Daily Meal OTP: ${otp}. Ma co hieu luc trong 5 phut.`;

  if (provider === "twilio") {
    await sendWithTwilio(phone, message);
    return;
  }

  throw new HttpError(503, "Chưa cấu hình dịch vụ gửi OTP.");
}
