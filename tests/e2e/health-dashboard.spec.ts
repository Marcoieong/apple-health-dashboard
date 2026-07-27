import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const themeKey = 'personal-health-dashboard:theme';
const screenshotDir = path.resolve('docs/screenshots');

async function navigateTo(page: Page, label: string) {
  await page
    .locator('.side-nav button:visible, .bottom-nav button:visible', { hasText: label })
    .click();
}

test('Dashboard 是由 ChatGPT 管理資料的只讀三頁介面', async ({ page }) => {
  await page.addInitScript((theme) => localStorage.setItem(theme, 'light'), themeKey);
  await page.goto('/');

  await expect(page.getByText('ChatGPT 匯入 · Demo')).toBeVisible();
  await expect(page.getByText('編輯資料')).toHaveCount(0);
  await expect(page.getByText('數據輸入')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '輸入' })).toHaveCount(0);
  await expect(page.locator('input, textarea, select')).toHaveCount(0);

  const visibleNavigation = page.locator('.side-nav button:visible, .bottom-nav button:visible');
  await expect(visibleNavigation).toHaveCount(3);
  await expect(visibleNavigation).toHaveText(['今日', '每週', '每月']);

  await navigateTo(page, '每週');
  await expect(page.getByRole('heading', { name: '每週趨勢' })).toBeVisible();
  await navigateTo(page, '每月');
  await expect(page.getByRole('heading', { name: '每月進度' })).toBeVisible();

  expect(
    await page.evaluate(() => localStorage.getItem('personal-health-dashboard:v1'))
  ).toBeNull();
});

test('深色模式、圖表與五種響應式尺寸沒有橫向溢出', async ({ page }) => {
  await page.addInitScript((theme) => localStorage.setItem(theme, 'light'), themeKey);
  await page.goto('/');

  const sizes = [
    { name: 'iphone-15-pro', width: 393, height: 852 },
    { name: 'iphone-pro-max', width: 430, height: 932 },
    { name: 'ipad', width: 768, height: 1024 },
    { name: 'desktop-1366', width: 1366, height: 768 },
    { name: 'desktop-1920', width: 1920, height: 1080 }
  ];

  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, `${size.name} 不應橫向溢出`).toBeLessThanOrEqual(0);
  }

  await page.setViewportSize({ width: 393, height: 852 });
  await expect(page.getByText('ChatGPT 匯入 · Demo')).toBeVisible();
  await expect(page.getByLabel(/今日健康總分/)).toBeVisible();
  await expect(page.locator('.bottom-nav button')).toHaveCount(3);
  await page.screenshot({
    path: path.join(screenshotDir, 'iphone-15-pro-today-read-only-light.png'),
    fullPage: true
  });

  await page.getByRole('button', { name: '切換至深色模式' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({
    path: path.join(screenshotDir, 'iphone-15-pro-today-dark.png'),
    fullPage: true
  });

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByRole('button', { name: '切換至淺色模式' }).click();
  await navigateTo(page, '每週');
  await expect(page.getByRole('heading', { name: '每週趨勢' })).toBeVisible();
  await expect(page.getByRole('img', { name: '最近七日健康分數與步數折線圖' })).toBeVisible();
  await expect(page.getByRole('img', { name: '每日活動卡路里與運動分鐘趨勢圖' })).toBeVisible();
  await expect(page.locator('.recharts-line-curve')).toHaveCount(5);
  await expect(page.locator('.recharts-line-curve').first()).toHaveAttribute('d', /[1-9]/);
  await expect(page.locator('.recharts-area-area')).toHaveCount(1);
  await page.screenshot({
    path: path.join(screenshotDir, 'desktop-1366-weekly-light.png'),
    fullPage: true
  });
});
