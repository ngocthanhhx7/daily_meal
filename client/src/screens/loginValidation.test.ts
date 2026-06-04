import { describe, expect, it } from "vitest";
import { createAuthErrorState, getAuthErrorMessage, validateForgotPasswordForm, validateLoginForm } from "./loginValidation";

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

describe("validateForgotPasswordForm", () => {
  it("requires a valid email before requesting reset OTP", () => {
    expect(validateForgotPasswordForm({ email: "", otp: "", otpSent: false })).toEqual({
      title: "Thiáº¿u email",
      message: "Vui lÃ²ng nháº­p email Ä‘á»ƒ nháº­n mÃ£ OTP."
    });

    expect(validateForgotPasswordForm({ email: "daily-meal", otp: "", otpSent: false })).toEqual({
      title: "Email khÃ´ng há»£p lá»‡",
      message: "Vui lÃ²ng nháº­p Ä‘Ãºng Ä‘á»‹nh dáº¡ng email."
    });
  });

  it("requires a 6-digit OTP before resetting password", () => {
    expect(validateForgotPasswordForm({ email: "user@example.com", otp: "12", otpSent: true })).toEqual({
      title: "MÃ£ OTP khÃ´ng há»£p lá»‡",
      message: "Vui lÃ²ng nháº­p mÃ£ OTP gá»“m 6 chá»¯ sá»‘."
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

describe("createAuthErrorState", () => {
  it("builds a persistent login error from an API failure", () => {
    expect(createAuthErrorState("login", new Error("Invalid email or password"))).toEqual({
      title: "Không thể đăng nhập",
      message: "Email hoặc mật khẩu không đúng."
    });
  });

  it("builds a persistent register error from an API failure", () => {
    expect(createAuthErrorState("register", new Error("Email is already registered"))).toEqual({
      title: "Không thể tạo tài khoản",
      message: "Email này đã được đăng ký."
    });
  });
});
