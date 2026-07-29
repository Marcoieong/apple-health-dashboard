import { expect, test, type Page } from '@playwright/test';

const themeKey = 'personal-health-dashboard:theme';
const storageKey = 'personal-health-dashboard.records';

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

test('公開 Dashboard 為唯讀，不顯示人工輸入控制', async ({ page }) => {
  await expect(page.getByText('Demo Data · 非真實資料')).toBeVisible();
  await expect(page.getByText('唯讀 Dashboard')).toBeVisible();
  await expect(page.getByText('不提供網頁人工輸入')).toBeVisible();
  await expect(page.getByRole('button', { name: '輸入' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /編輯|新增|儲存|匯入|匯出|刪除/ })).toHaveCount(0);
  await expect(page.locator('input, textarea, select')).toHaveCount(0);

  await page.evaluate((key) => {
    localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, records: [] }));
  }, storageKey);
  await page.reload();

  await expect(page.getByRole('heading', { name: '尚未有健康紀錄' })).toBeVisible();
  await expect(page.getByText('健康紀錄將由私人 iPhone Shortcut 流程導入')).toBeVisible();
  await expect(page.getByRole('button', { name: /新增|輸入|匯入/ })).toHaveCount(0);
});

test('可讀取由私人流程寫入的紀錄', async ({ page }) => {
  await page.evaluate((key) => {
    const now = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify({
      schemaVersion: 1,
      records: [{
        id: 'chatgpt-record-1',
        date: '2030-01-02',
        steps: 11000,
        activeCalories: 620,
        exerciseMinutes: 45,
        sleepHours: 7.5,
        weightKg: 97.4,
        bodyFatPercent: 32.4,
        waistCm: 103,
        strengthTraining: true,
        lunchHighProtein: true,
        dinnerHighProtein: true,
        vegetablesCompleted: true,
        noSugaryDrink: true,
        noLateNightMeal: true,
        source: 'chatgpt',
        createdAt: now,
        updatedAt: now,
      }],
    }));
  }, storageKey);
  await page.reload();

  await expect(page.getByRole('heading', { name: /2030年1月2日/ })).toBeVisible();
  await expect(page.getByLabel(/今日健康總分/)).toBeVisible();
  await expect(page.getByText('11,000 步', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '編輯' })).toHaveCount(0);
});

test('飲食日誌維持私人資料邊界', async ({ page }) => {
  await navigateTo(page, '飲食日誌');
  await expect(page.getByRole('heading', { name: '飲食日誌' })).toBeVisible();
  await expect(page.getByRole('img', { name: '示範餐點相片預留位置' })).toHaveCount(5);
  await expect(page.getByText('私人紀錄已鎖定')).toBeVisible();
  await expect(page.getByLabel('私人存取碼')).toHaveAttribute('type', 'password');
  await expect(page.getByRole('button', { name: '載入私人紀錄' })).toBeVisible();
});

test('私人餐食解鎖只保留於當次頁面', async ({ page }) => {
  await page.route('**/api/private/meals', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer test-access-code');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Cache-Control': 'private, no-store' },
      body: JSON.stringify({
        meals: [
          {
            id: 'opaque-meal-123',
            localDate: '2030-01-02',
            timezone: 'Asia/Macau',
            mealType: 'dinner',
            foodLabels: ['雞肉', '西蘭花'],
            preparationMethods: ['清蒸'],
            notes: 'Shortcut 測試紀錄',
            source: 'shortcut',
            photoCount: 1,
            recordedAt: '2030-01-02T12:00:00.000Z',
          },
        ],
      }),
    });
  });

  await navigateTo(page, '飲食日誌');
  await page.getByLabel('私人存取碼').fill('test-access-code');
  await page.getByRole('button', { name: '載入私人紀錄' }).click();

  await expect(page.getByText('私人紀錄已解鎖')).toBeVisible();
  await expect(page.getByRole('heading', { name: '雞肉、西蘭花' })).toBeVisible();
  await expect(page.getByText('1 張 · 不在公開頁載入')).toBeVisible();
  await expect(page.locator('.journal-meal-card img')).toHaveCount(0);
  await expect(page.getByLabel('私人存取碼')).toHaveCount(0);

  const browserStorage = await page.evaluate(() => ({
    local: JSON.stringify(localStorage),
    session: JSON.stringify(sessionStorage),
  }));
  expect(browserStorage.local).not.toContain('test-access-code');
  expect(browserStorage.session).not.toContain('test-access-code');

  await page.getByRole('button', { name: '鎖定' }).click();
  await expect(page.getByText('私人紀錄已鎖定')).toBeVisible();
  await expect(page.getByRole('heading', { name: '雞肉、西蘭花' })).toHaveCount(0);

  await page.getByLabel('私人存取碼').fill('test-access-code');
  await page.getByRole('button', { name: '載入私人紀錄' }).click();
  await expect(page.getByText('私人紀錄已解鎖')).toBeVisible();
  await page.reload();
  await navigateTo(page, '飲食日誌');
  await expect(page.getByText('私人紀錄已鎖定')).toBeVisible();
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
  await expect(page.locator('.bottom-nav button')).toHaveCount(4);
  await page.screenshot({
    path: testInfo.outputPath('iphone-15-pro-today-light.png'),
    fullPage: true,
  });

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
