import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { HttpError } from "../middleware/error.js";

function hasSmtpConfig() {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.MAIL_FROM_EMAIL);
}

function requireSmtpConfig() {
  if (env.NODE_ENV === "test") {
    return undefined;
  }

  if (!hasSmtpConfig()) {
    if (env.NODE_ENV !== "production") {
      return undefined;
    }
    throw new HttpError(500, "Email SMTP chưa được cấu hình trên server.");
  }

  return {
    host: env.SMTP_HOST!,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER!,
      pass: env.SMTP_PASS!
    }
  };
}

async function sendMail(input: { to: string; subject: string; text: string; html: string }) {
  const smtpConfig = requireSmtpConfig();

  if (!smtpConfig) {
    console.log(`[DEV EMAIL] To: ${input.to} | ${input.subject}\n${input.text}`);
    return;
  }

  const transporter = nodemailer.createTransport(smtpConfig);
  await transporter.sendMail({
    from: `"${env.MAIL_FROM_NAME}" <${env.MAIL_FROM_EMAIL}>`,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html
  });
}

export async function sendPasswordResetOtpEmail(to: string, otp: string) {
  await sendMail({
    to,
    subject: "Daily Meal - Mã OTP quên mật khẩu",
    text: `Mã OTP đặt lại mật khẩu Daily Meal của bạn là ${otp}. Mã có hiệu lực trong 5 phút.`,
    html: `<p>Mã OTP đặt lại mật khẩu Daily Meal của bạn là <strong>${otp}</strong>.</p><p>Mã có hiệu lực trong 5 phút.</p>`
  });
}

export async function sendPasswordResetSuccessEmail(to: string) {
  await sendMail({
    to,
    subject: "Daily Meal - Mật khẩu đã được thay đổi",
    text: `Mật khẩu Daily Meal của bạn đã được thay đổi thành công.`,
    html: `<p>Mật khẩu Daily Meal của bạn đã được thay đổi thành công.</p>`
  });
}

