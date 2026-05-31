import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

function formatZodIssue(issue: ZodError["issues"][number]) {
  const field = issue.path.at(-1)?.toString();

  if (field === "email") {
    return "Email không hợp lệ.";
  }

  if (field === "password" || field === "newPassword") {
    return "Mật khẩu cần ít nhất 6 ký tự.";
  }

  if (field === "currentPassword") {
    return "Mật khẩu hiện tại cần ít nhất 6 ký tự.";
  }

  if (field === "phone") {
    return "Số điện thoại không hợp lệ.";
  }

  if (field === "otp") {
    return "Mã OTP phải gồm 6 chữ số.";
  }

  if (field === "idToken") {
    return "Phiên đăng nhập Google không hợp lệ.";
  }

  if (field === "accessToken") {
    return "Phiên đăng nhập Facebook không hợp lệ.";
  }

  if (field === "displayName") {
    return "Tên hiển thị không hợp lệ.";
  }

  return issue.message;
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    const message = error.issues.map(formatZodIssue).join(" ");

    res.status(400).json({
      message: message || "Thông tin gửi lên chưa hợp lệ.",
      issues: error.issues
    });
    return;
  }

  const statusCode = error instanceof HttpError ? error.statusCode : 500;
  res.status(statusCode).json({
    message: error instanceof Error ? error.message : "Unexpected server error"
  });
};
