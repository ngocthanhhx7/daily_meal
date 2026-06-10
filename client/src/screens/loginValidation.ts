export type LoginValidationInput = {
  authMethod: "email" | "phone";
  mode: "login" | "register";
  identifier: string;
  password: string;
  otp: string;
  phoneOtpSent: boolean;
  phoneNeedsPassword: boolean;
};

export type LoginValidationError = {
  title: string;
  message: string;
};

export type LoginMode = "login" | "register";

export type ForgotPasswordValidationInput = {
  email: string;
  otp: string;
  otpSent: boolean;
  newPassword?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLoginForm(input: LoginValidationInput): LoginValidationError | null {
  const identifier = input.identifier.trim();
  const password = input.password.trim();
  const otp = input.otp.trim();

  if (input.authMethod === "phone") {
    if (!identifier) {
      return {
        title: "Thiếu số điện thoại",
        message: "Vui lòng nhập số điện thoại trước khi lấy mã OTP."
      };
    }

    if (!input.phoneOtpSent) {
      return null;
    }

    if (!/^\d{6}$/.test(otp)) {
      return {
        title: "Mã OTP không hợp lệ",
        message: "Vui lòng nhập mã OTP gồm 6 chữ số."
      };
    }

    if (input.phoneNeedsPassword && password.length < 6) {
      return {
        title: "Mật khẩu quá ngắn",
        message: "Mật khẩu cần ít nhất 6 ký tự."
      };
    }

    return null;
  }

  if (!identifier) {
    return {
      title: "Thiếu email",
      message: input.mode === "login" ? "Vui lòng nhập email để đăng nhập." : "Vui lòng nhập email để tạo tài khoản."
    };
  }

  if (!emailPattern.test(identifier)) {
    return {
      title: "Email không hợp lệ",
      message: "Vui lòng nhập đúng định dạng email."
    };
  }

  if (password.length < 6) {
    return {
      title: "Mật khẩu quá ngắn",
      message: "Mật khẩu cần ít nhất 6 ký tự."
    };
  }

  return null;
}

export function validateForgotPasswordForm(input: ForgotPasswordValidationInput): LoginValidationError | null {
  const email = input.email.trim();
  const otp = input.otp.trim();

  if (!email) {
    return {
      title: "Thiếu email",
      message: "Vui lòng nhập email để nhận mã OTP."
    };
  }

  if (!emailPattern.test(email)) {
    return {
      title: "Email không hợp lệ",
      message: "Vui lòng nhập đúng định dạng email."
    };
  }

  if (input.otpSent) {
    if (!/^\d{6}$/.test(otp)) {
      return {
        title: "Mã OTP không hợp lệ",
        message: "Vui lòng nhập mã OTP gồm 6 chữ số."
      };
    }
    if (input.newPassword !== undefined && input.newPassword.trim().length < 8) {
      return {
        title: "Mật khẩu quá ngắn",
        message: "Mật khẩu mới cần ít nhất 8 ký tự."
      };
    }
  }

  return null;
}

export function getAuthErrorMessage(error: unknown, fallback = "Thử lại sau") {
  const message = error instanceof Error ? error.message : "";

  if (!message) {
    return fallback;
  }

  if (message.includes("Google login was cancelled")) {
    return "Bạn đã hủy đăng nhập Google.";
  }

  if (message.includes("EXPO_PUBLIC_GOOGLE") || message.includes("Google sign-in is not configured")) {
    return "Google chưa được cấu hình. Vui lòng kiểm tra Google Client ID.";
  }

  if (message.includes("Google did not return an ID token")) {
    return "Google không trả về mã đăng nhập. Vui lòng thử lại.";
  }

  if (message.includes("Google login timed out")) {
    return "Đăng nhập Google quá thời gian. Vui lòng thử lại.";
  }

  if (message.includes("Could not load Google login")) {
    return "Không tải được Google Login. Kiểm tra kết nối mạng rồi thử lại.";
  }

  if (message === "Validation failed") {
    return "Thông tin đăng nhập chưa hợp lệ. Vui lòng kiểm tra lại.";
  }

  if (message.includes("Invalid email or password")) {
    return "Email hoặc mật khẩu không đúng.";
  }

  if (message.includes("Email is already registered")) {
    return "Email này đã được đăng ký.";
  }

  return message;
}

export function createAuthErrorState(mode: LoginMode, error: unknown): LoginValidationError {
  return {
    title: mode === "login" ? "Không thể đăng nhập" : "Không thể tạo tài khoản",
    message: getAuthErrorMessage(error)
  };
}
