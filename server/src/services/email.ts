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
    throw new HttpError(500, "Email SMTP chua duoc cau hinh tren server.");
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
    subject: "Daily Meal - Ma OTP quen mat khau",
    text: `Ma OTP dat lai mat khau Daily Meal cua ban la ${otp}. Ma co hieu luc trong 5 phut.`,
    html: `<p>Ma OTP dat lai mat khau Daily Meal cua ban la <strong>${otp}</strong>.</p><p>Ma co hieu luc trong 5 phut.</p>`
  });
}

export async function sendPasswordResetSuccessEmail(to: string) {
  await sendMail({
    to,
    subject: "Daily Meal - Mat khau da duoc thay doi",
    text: `Mat khau Daily Meal cua ban da duoc thay doi thanh cong.`,
    html: `<p>Mat khau Daily Meal cua ban da duoc thay doi thanh cong.</p>`
  });
}

