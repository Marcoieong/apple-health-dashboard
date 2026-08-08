const DEVICE_INSTALLATION_ID = /^[A-Za-z0-9_-]{16,128}$/;
const STATE = /^[A-Za-z0-9_-]{32,128}$/;

export interface HealthBridgeEnrollmentInput {
  deviceInstallationId: string;
  state: string;
}

function first(value: unknown): string {
  return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
}

export function parseHealthBridgeEnrollmentInput(
  values: Record<string, unknown>
): HealthBridgeEnrollmentInput {
  const deviceInstallationId = first(values.device_installation_id);
  const state = first(values.state);
  if (!DEVICE_INSTALLATION_ID.test(deviceInstallationId)) {
    throw new Error('invalid_device_id');
  }
  if (!STATE.test(state)) throw new Error('invalid_state');
  return { deviceInstallationId, state };
}

export function buildHealthBridgeEnrollmentPath(
  input: HealthBridgeEnrollmentInput
): string {
  const query = new URLSearchParams({
    device_installation_id: input.deviceInstallationId,
    state: input.state
  });
  return `/api/health-sync/enroll?${query.toString()}`;
}

export function buildHealthBridgeCallbackUrl(
  input: HealthBridgeEnrollmentInput,
  token: string,
  baseUrl: URL
): string {
  const callback = new URL('healthbridge://enroll');
  callback.searchParams.set('state', input.state);
  callback.hash = new URLSearchParams({
    token,
    device_installation_id: input.deviceInstallationId,
    base_url: baseUrl.origin
  }).toString();
  return callback.href;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[character] ?? character
  );
}

export function renderHealthBridgeEnrollmentPage(
  input: HealthBridgeEnrollmentInput
): string {
  const deviceSuffix = escapeHtml(input.deviceInstallationId.slice(-6));
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="color-scheme" content="light dark">
  <title>授權 HealthBridge</title>
  <style>
    :root { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; color-scheme: light dark; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: Canvas; color: CanvasText; }
    main { width: min(34rem, calc(100% - 2rem)); padding: max(1.5rem, env(safe-area-inset-top)) 0 max(1.5rem, env(safe-area-inset-bottom)); }
    section { border: 1px solid color-mix(in srgb, CanvasText 15%, transparent); border-radius: 1.25rem; padding: 1.5rem; }
    h1 { margin-top: 0; font-size: 1.75rem; }
    p { line-height: 1.55; }
    .note { color: color-mix(in srgb, CanvasText 68%, transparent); }
    button { width: 100%; min-height: 3rem; margin-top: 1rem; border: 0; border-radius: .8rem; color: white; background: #1677ff; font: inherit; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <section>
      <h1>授權這部 iPhone</h1>
      <p>HealthBridge 將只讀取 Apple Health 的每日匯總：步數、活動能量、運動分鐘、睡眠、體重及體脂率。</p>
      <p>裝置：HealthBridge ···${deviceSuffix}</p>
      <p class="note">不會讀取病歷、藥物、定位或原始逐筆樣本。同步金鑰只會返回這部 iPhone 並存入 Keychain。</p>
      <form method="post" action="/api/health-sync/enroll">
        <input type="hidden" name="device_installation_id" value="${escapeHtml(input.deviceInstallationId)}">
        <input type="hidden" name="state" value="${escapeHtml(input.state)}">
        <button type="submit">確認並連接</button>
      </form>
    </section>
  </main>
</body>
</html>`;
}
