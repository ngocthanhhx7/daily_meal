const { test, expect } = require("playwright/test");

test.use({
  channel: "chrome",
  viewport: { width: 390, height: 844 }
});

test("daily meal progress smoke", async ({ page }) => {
  await page.goto("http://localhost:8081/");
  await page.getByPlaceholder("Nhập tên đăng nhập").fill("w2shoutaro@gmail.com");
  await page.getByPlaceholder("Nhập mật khẩu").fill("@Thanh05052004");
  await page.getByText("Đăng nhập", { exact: true }).click();
  await expect(page.getByText("Bảng tin")).toBeVisible({ timeout: 20000 });
  await page.screenshot({ path: ".logs/qa-after-login.png", fullPage: true });

  await page.getByText("Bảng tin").click();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.getByText("Cài đặt").click({ timeout: 10000 });
  await page.getByText("Theo dõi tiến độ đăng bài").click({ timeout: 10000 });
  await expect(page.getByText("Theo dõi tiến độ")).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: ".logs/qa-progress.png", fullPage: true });
});
