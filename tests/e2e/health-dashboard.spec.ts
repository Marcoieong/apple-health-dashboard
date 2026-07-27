import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const storageKey = 'personal-health-dashboard:v1';
const themeKey = 'personal-health-dashboard:theme';
const screenshotDir = path.resolve('docs/screenshots');

async function startWithEmptyStorage(page: Page) {
  await page.goto('/');
  await page.evaluate(
    ({ key, theme }) => {
      localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, records: [] }));
      localStorage.setItem(theme, 'light');
    },
    { key: storageKey, theme: themeKey }
  );
  await page.reload();
}

async function openEntry(page: Page) {
  await page.locator('.side-nav button:visible, .bottom-nav button:visible', { hasText: '輸入' }).click();
  await expect(page.getByRole('heading', { name: '數據輸入' })).toBeVisible();
}

async function navigateTo(page: Page, label: string) {
  await page
    .locator('.side-nav button:visible, .bottom-nav button:visible', { hasText: label })
    .click();
}

function numericInput(page: Page, label: string) {
  return page.locator('label', { hasText: label }).locator('input[type="number"]');
}

test('完整 CRUD、重整保存、匯入匯出及空狀態流程', async ({ page }) => {
  await startWithEmptyStorage(page);
  await expect(page.getByRole('heading', { name: '尚未有健康紀錄' })).toBeVisible();
  await openEntry(page);

  await page.locator('input[type="date"]').fill('2026-07-27');
  await numericInput(page, '步數').fill('10250');
  await numericInput(page, '活動卡路里').fill('620');
  await numericInput(page, '運動分鐘').fill('42');
  await numericInput(page, '睡眠時數').fill('7.5');
  await numericInput(page, '體重').fill('97.8');
  await numericInput(page, '體脂率').fill('32.5');
  await numericInput(page, '腰圍').fill('106');
  await page.getByLabel('完成力量訓練').check();
  await page.getByLabel('午餐高蛋白').check();
  await page.getByLabel('晚餐高蛋白').check();
  await page.getByLabel('有足夠蔬菜').check();
  await page.getByLabel('沒有含糖飲料').check();
  await page.getByLabel('沒有吃宵夜').check();
  await page.getByLabel('備註').fill('端到端測試紀錄');
  await page.getByRole('button', { name: '儲存紀錄' }).click();
  await expect(page.getByRole('status')).toContainText('紀錄已新增');

  await page.reload();
  await openEntry(page);
  await expect(page.getByLabel('選擇已有紀錄').locator('option')).toHaveCount(2);
  await page
    .getByLabel('選擇已有紀錄')
    .selectOption({ label: '2026-07-27 · 個人紀錄' });
  await numericInput(page, '步數').fill('11000');
  await page.getByRole('button', { name: '儲存變更' }).click();
  await expect(page.getByRole('status')).toContainText('紀錄已更新');

  const jsonDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '匯出 JSON' }).click();
  expect((await jsonDownload).suggestedFilename()).toMatch(/health-records.*\.json/);

  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '匯出 CSV' }).click();
  expect((await csvDownload).suggestedFilename()).toMatch(/health-records.*\.csv/);

  const importPayload = {
    schemaVersion: 1,
    records: [
      {
        date: '2026-07-26',
        steps: 9001,
        activeCalories: 510,
        exerciseMinutes: 31,
        sleepHours: 7.25,
        lunchHighProtein: true,
        dinnerHighProtein: true,
        vegetablesCompleted: true,
        noSugaryDrink: true,
        noLateNightMeal: true
      }
    ]
  };
  await page.locator('input[type="file"]').setInputFiles({
    name: 'health-import.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(importPayload))
  });
  await expect(page.getByRole('status')).toContainText('已匯入 1 筆');
  await page
    .getByLabel('選擇已有紀錄')
    .selectOption({ label: '2026-07-26 · 個人紀錄' });

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '刪除' }).click();
  await expect(page.getByRole('status')).toContainText('紀錄已刪除');

  await navigateTo(page, '今日');
  await expect(page.getByRole('heading', { name: '尚未有健康紀錄' })).toBeVisible();
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
  await expect(page.getByText('Demo Data')).toBeVisible();
  await expect(page.getByLabel(/今日健康總分/)).toBeVisible();
  await page.screenshot({
    path: path.join(screenshotDir, 'iphone-15-pro-today-light.png'),
    fullPage: true
  });

  await openEntry(page);
  await page.screenshot({
    path: path.join(screenshotDir, 'iphone-15-pro-data-entry-light.png'),
    fullPage: true
  });

  await navigateTo(page, '今日');
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
