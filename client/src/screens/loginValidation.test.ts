import { describe, expect, it } from "vitest";
import { getAuthErrorMessage, validateLoginForm } from "./loginValidation";

describe("validateLoginForm", () => {
  it("requires a valid email and password for email login", () => {
    expect(
      validateLoginForm({
        authMethod: "email",
        mode: "login",
        identifier: "",
        password: "",
        otp: "",
        phoneOtpSent: false,
        phoneNeedsPassword: false
      })
    ).toEqual({
      title: "Thiếu email",
      message: "Vui lòng nhập email để đăng nhập."
    });

    expect(
      validateLoginForm({
        authMethod: "email",
        mode: "login",
        identifier: "daily-meal",
        password: "123456",
        otp: "",
        phoneOtpSent: false,
        phoneNeedsPassword: false
      })
    ).toEqual({
      title: "Email không hợp lệ",
      message: "Vui lòng nhập đúng định dạng email."
    });

    expect(
      validateLoginForm({
        authMethod: "email",
        mode: "login",
        identifier: "user@example.com",
        password: "123",
        otp: "",
        phoneOtpSent: false,
        phoneNeedsPassword: false
      })
    ).toEqual({
      title: "Mật khẩu quá ngắn",
      message: "Mật khẩu cần ít nhất 6 ký tự."
    });
  });

  it("requires phone, 6-digit OTP, and setup password when needed", () => {
    expect(
      validateLoginForm({
        authMethod: "phone",
        mode: "login",
        identifier: "",
        password: "",
        otp: "",
        phoneOtpSent: false,
        phoneNeedsPassword: false
      })
    ).toEqual({
      title: "Thiếu số điện thoại",
      message: "Vui lòng nhập số điện thoại trước khi lấy mã OTP."
    });

    expect(
      validateLoginForm({
        authMethod: "phone",
        mode: "login",
        identifier: "0912345678",
        password: "",
        otp: "12",
        phoneOtpSent: true,
        phoneNeedsPassword: false
      })
    ).toEqual({
      title: "Mã OTP không hợp lệ",
      message: "Vui lòng nhập mã OTP gồm 6 chữ số."
    });

    expect(
      validateLoginForm({
        authMethod: "phone",
        mode: "login",
        identifier: "0912345678",
        password: "123",
        otp: "123456",
        phoneOtpSent: true,
        phoneNeedsPassword: true
      })
    ).toEqual({
      title: "Mật khẩu quá ngắn",
      message: "Mật khẩu cần ít nhất 6 ký tự."
    });
  });
});

describe("getAuthErrorMessage", () => {
  it("maps common Google and API errors to user-readable Vietnamese messages", () => {
    expect(getAuthErrorMessage(new Error("Google login was cancelled."))).toBe(
      "Bạn đã hủy đăng nhập Google."
    );

    expect(getAuthErrorMessage(new Error("Google login is missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID."))).toBe(
      "Google chưa được cấu hình. Vui lòng kiểm tra Google Client ID."
    );

    expect(getAuthErrorMessage(new Error("Validation failed"))).toBe(
      "Thông tin đăng nhập chưa hợp lệ. Vui lòng kiểm tra lại."
    );
  });
});
