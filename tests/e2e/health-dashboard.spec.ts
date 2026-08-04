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
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Cache-Control': 'private, no-store' },
      body: JSON.stringify({ authenticated: false }),
    });
  });
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
  await expect(page.getByText('健康紀錄將由私人 iPhone 同步流程導入')).toBeVisible();
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
  await expect(page.getByText('家庭私人紀錄')).toBeVisible();
  await expect(page.getByRole('button', { name: '登入家庭帳戶' })).toBeVisible();
  await expect(page.getByLabel('私人存取碼')).toHaveCount(0);
});

test('家庭登入只載入該成員的私人餐食與受保護縮圖', async ({ page }) => {
  await page.unroute('**/api/auth/session');
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Cache-Control': 'private, no-store' },
      body: JSON.stringify({
        authenticated: true,
        member: { email: 'member@example.com', name: '家庭成員', isAdmin: false },
      }),
    });
  });
  await page.route('**/api/private/meals', async (route) => {
    expect(route.request().headers().authorization).toBeUndefined();
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
            thumbnail: {
              url: '/api/private/photo?token=signed-locator',
              width: 640,
              height: 480,
            },
            recordedAt: '2030-01-02T12:00:00.000Z',
          },
        ],
      }),
    });
  });
  await page.route('**/api/private/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Cache-Control': 'private, no-store' },
      body: JSON.stringify({
        range: { start: '2030-01-01', end: '2030-01-31', timezone: 'Asia/Macau' },
        days: [],
      }),
    });
  });
  await page.route('**/api/private/health/sync-status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Cache-Control': 'private, no-store' },
      body: JSON.stringify({ devices: [] }),
    });
  });
  await page.route('**/api/private/shortcut-credentials', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ credentials: [] }),
    });
  });

  await page.goto('/?section=food-journal');

  await expect(page.getByText('家庭成員的私人空間')).toBeVisible();
  await expect(page.getByRole('heading', { name: '雞肉、西蘭花' })).toBeVisible();
  await expect(page.locator('.journal-meal-card img')).toHaveAttribute(
    'src',
    '/api/private/photo?token=signed-locator',
  );
  await expect(page.getByText('家庭成員 · 只讀')).toBeVisible();
  await expect(page.getByLabel('私人存取碼')).toHaveCount(0);
  await expect(page.getByText('iPhone 上傳設定')).toBeVisible();

  const browserStorage = await page.evaluate(() => ({
    local: JSON.stringify(localStorage),
    session: JSON.stringify(sessionStorage),
  }));
  expect(browserStorage.local).not.toContain('signed-locator');
  expect(browserStorage.session).not.toContain('signed-locator');
  expect(browserStorage.local).not.toContain('member@example.com');
  expect(browserStorage.session).not.toContain('member@example.com');
});

test('家庭登入顯示成員隔離的 Apple Health 資料且不混入 Demo Data', async ({ page }) => {
  await page.unroute('**/api/auth/session');
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Cache-Control': 'private, no-store' },
      body: JSON.stringify({
        authenticated: true,
        member: { email: 'member@example.com', name: '家庭成員', isAdmin: false },
      }),
    });
  });
  await page.route('**/api/private/meals', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Cache-Control': 'private, no-store' },
      body: JSON.stringify({ meals: [] }),
    });
  });
  await page.route('**/api/private/health', async (route) => {
    expect(route.request().headers().authorization).toBeUndefined();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Cache-Control': 'private, no-store' },
      body: JSON.stringify({
        range: { start: '2030-01-01', end: '2030-01-31', timezone: 'Asia/Macau' },
        days: [
          {
            local_date: '2030-01-02',
            timezone: 'Asia/Macau',
            source_updated_at: '2030-01-02T13:00:00.000Z',
            steps: 12345,
            active_energy_kcal: 678,
            exercise_minutes: 46,
            sleep_hours: 7.75,
            weight_kg: 96.8,
            body_fat_percent: 31.9,
          },
        ],
      }),
    });
  });
  await page.route('**/api/private/health/sync-status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Cache-Control': 'private, no-store' },
      body: JSON.stringify({
        devices: [
          {
            deviceInstallationId: 'private-device-id-must-not-render',
            lastCollectedAt: '2030-01-02T12:55:00.000Z',
            lastSyncAt: '2030-01-02T13:00:00.000Z',
          },
        ],
      }),
    });
  });

  await page.goto('/');

  await expect(page.getByText('私人 Apple Health 資料')).toBeVisible();
  await expect(page.getByText('1 部裝置')).toBeVisible();
  await expect(page.getByText('12,345 步', { exact: true })).toBeVisible();
  await expect(page.getByText('Demo Data · 非真實資料')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('private-device-id-must-not-render');
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
