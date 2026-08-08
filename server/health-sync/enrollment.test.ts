import { describe, expect, it } from 'vitest';
import {
  buildHealthBridgeCallbackUrl,
  buildHealthBridgeEnrollmentPath,
  parseHealthBridgeEnrollmentInput,
  renderHealthBridgeEnrollmentPage
} from './enrollment.js';

const input = {
  deviceInstallationId: 'iphone_1234567890abcdef',
  state: 'state_1234567890abcdefghijklmnop'
};

describe('HealthBridge enrollment', () => {
  it('validates device and state values', () => {
    expect(
      parseHealthBridgeEnrollmentInput({
        device_installation_id: input.deviceInstallationId,
        state: input.state
      })
    ).toEqual(input);
    expect(() =>
      parseHealthBridgeEnrollmentInput({ device_installation_id: 'short' })
    ).toThrow('invalid_device_id');
  });

  it('builds a safe same-origin return path', () => {
    expect(buildHealthBridgeEnrollmentPath(input)).toContain(
      '/api/health-sync/enroll?device_installation_id=iphone_'
    );
  });

  it('keeps the credential in the callback fragment', () => {
    const callback = buildHealthBridgeCallbackUrl(
      input,
      'secret-token',
      new URL('https://preview.example.test/path')
    );
    expect(callback).toContain('healthbridge://enroll?state=');
    expect(callback).toContain('#token=secret-token');
    expect(callback.split('#')[0]).not.toContain('secret-token');
  });

  it('renders an explicit consent page without the credential', () => {
    const html = renderHealthBridgeEnrollmentPage(input);
    expect(html).toContain('授權這部 iPhone');
    expect(html).toContain('確認並連接');
    expect(html).not.toContain('secret-token');
  });
});
