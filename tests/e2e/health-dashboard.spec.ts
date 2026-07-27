import { expect, test, type Page } from '@playwright/test';

const themeKey = 'personal-health-dashboard:theme';

async function navigateTo(page: Page, label: string) {
  await page
    .locator('.side-nav button:visible, .bottom-nav button:visible')
    .filter({ hasText: label })
    .click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((theme) => localStorage.setItem(theme, 'light'), themeKey);
  await page.goto('/');
});

test('可新增、編輯、重新整理保存及刪除健康紀錄', async ({ page }) => {
  await expect(page.getByText('Demo Data · 非真實資料')).toBeVisible();
  await navigateTo(page, '輸入');
  await expect(page.getByRole('heading', { name: '數據輸入' })).toBeVisible();

  await page.getByLabel('日期').fill('2030-01-02');
  await page.getByLabel('步數').fill('9200');
  await page.getByLabel('活動卡路里').fill('540');
  await page.getByLabel('運動分鐘').fill('35');
  await page.getByLabel('睡眠時數').fill('7.5');
  await page.getByLabel('體重').fill('97.4');
  await page.getByLabel('午餐高蛋白').check();
  await page.getByLabel('晚餐高蛋白').check();
  await page.getByLabel('有足夠蔬菜').check();
  await page.getByLabel('沒有含糖飲料').check();
  await page.getByLabel('沒有吃宵夜').check();
  await page.getByRole('button', { name: '儲存紀錄' }).click();
  await expect(page.getByRole('status')).toContainText('紀錄已新增');

  await page.reload();
  await navigateTo(page, '輸入');
  await expect(page.getByLabel('選擇已有紀錄').locator('option', { hasText: '2030-01-02' }))
    .toHaveCount(1);

  const savedRecordId = await page
    .getByLabel('選擇已有紀錄')
    .locator('option', { hasText: '2030-01-02' })
    .getAttribute('value');
  expect(savedRecordId).toBeTruthy();
  await page.getByLabel('選擇已有紀錄').selectOption(savedRecordId!);
  await expect(page.getByLabel('步數')).toHaveValue('9200');
  await page.getByLabel('步數').fill('11000');
  await page.getByRole('button', { name: '儲存變更' }).click();
  await expect(page.getByRole('status')).toContainText('紀錄已更新');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '刪除' }).click();
  await expect(page.getByRole('status')).toContainText('紀錄已刪除');
  await expect(page.getByLabel('選擇已有紀錄').locator('option', { hasText: '2030-01-02' }))
    .toHaveCount(0);
});

test('可匯出 JSON／CSV，並驗證及匯入 JSON', async ({ page }) => {
  await navigateTo(page, '輸入');

  const jsonDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '匯出 JSON' }).click();
  expect((await jsonDownload).suggestedFilename()).toMatch(/health-records.*\.json/);

  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '匯出 CSV' }).click();
  expect((await csvDownload).suggestedFilename()).toMatch(/health-records.*\.csv/);

  await page.locator('input[type="file"]').setInputFiles({
    name: 'health-import.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      schemaVersion: 1,
      records: [{
        date: '2030-01-03',
        steps: 10050,
        activeCalories: 610,
        exerciseMinutes: 42,
        sleepHours: 7.25,
        noSugaryDrink: true,
        noLateNightMeal: true,
      }],
    })),
  });
  await expect(page.getByRole('status')).toContainText('已匯入 1 筆');
  await expect(page.getByLabel('選擇已有紀錄').locator('option', { hasText: '2030-01-03' }))
    .toHaveCount(1);

  await page.locator('input[type="file"]').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"records":"not-an-array"}'),
  });
  await expect(page.getByRole('status')).toContainText('找不到 records 陣列');
  await expect(page.getByLabel('選擇已有紀錄').locator('option', { hasText: '2030-01-03' }))
    .toHaveCount(1);
});

test('清除後保留空狀態，飲食日誌仍維持私人資料邊界', async ({ page }) => {
  await navigateTo(page, '輸入');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '清除全部' }).click();
  await expect(page.getByRole('status')).toContainText('本機資料已清除');

  await page.reload();
  await expect(page.getByRole('heading', { name: '尚未有健康紀錄' })).toBeVisible();
  await expect(page.getByText('Demo Data · 非真實資料')).toBeVisible();

  await navigateTo(page, '飲食日誌');
  await expect(page.getByRole('heading', { name: '飲食日誌' })).toBeVisible();
  await expect(page.getByRole('img', { name: '示範餐點相片預留位置' })).toHaveCount(5);
  await expect(page.getByText('私人相片尚未接入')).toBeVisible();
});

test('深色模式、圖表與五種響應式尺寸沒有橫向溢出', async ({ page }, testInfo) => {
  const sizes = [
    { name: 'iphone-15-pro', width: 393, height: 852 },
    { name: 'iphone-pro-max', width: 430, height: 932 },
    { name: 'ipad', width: 768, height: 1024 },
    { name: 'desktop-1366', width: 1366, height: 768 },
    { name: 'desktop-1920', width: 1920, height: 1080 },
  ];

  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${size.name} 不應橫向溢出`).toBeLessThanOrEqual(0);
  }

  await page.setViewportSize({ width: 393, height: 852 });
  await expect(page.getByLabel(/今日健康總分/)).toBeVisible();
  await expect(page.locator('.bottom-nav button')).toHaveCount(5);
  await page.screenshot({
    path: testInfo.outputPath('iphone-15-pro-today-light.png'),
    fullPage: true,
  });

  await navigateTo(page, '輸入');
  await expect(page.getByRole('heading', { name: '數據輸入' })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('iphone-15-pro-data-entry-light.png'),
    fullPage: true,
  });
  await navigateTo(page, '今日');

  await page.getByRole('button', { name: '切換至深色模式' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({
    path: testInfo.outputPath('iphone-15-pro-today-dark.png'),
    fullPage: true,
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
    path: testInfo.outputPath('desktop-1366-weekly-light.png'),
    fullPage: true,
  });
});
