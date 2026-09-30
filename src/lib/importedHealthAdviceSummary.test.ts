import { describe, expect, it } from 'vitest';
import { summarizeImportedHealthAdvice } from './importedHealthAdviceSummary';

describe('summarizeImportedHealthAdvice', () => {
  it('organises structured ChatGPT Health text without adding new advice', () => {
    const result = summarizeImportedHealthAdvice(`
## 重點
- 昨天睡眠不足七小時。
- 活動量比平日低。

## 今天可做
1. 晚飯後快走二十分鐘。
2. 今晚提早三十分鐘休息。

## 注意事項
- 如持續不適，請向醫療專業人員求助。
`);

    expect(result).toEqual({
      summary: ['昨天睡眠不足七小時。', '活動量比平日低。'],
      actions: ['晚飯後快走二十分鐘。', '今晚提早三十分鐘休息。'],
      cautions: ['如持續不適，請向醫療專業人員求助。']
    });
  });

  it('classifies plain text and removes duplicate sentences', () => {
    const result = summarizeImportedHealthAdvice(
      '昨天睡眠只有六小時。建議今晚提早三十分鐘睡眠。\n建議今晚提早三十分鐘睡眠。'
    );

    expect(result.summary).toEqual(['昨天睡眠只有六小時。']);
    expect(result.actions).toEqual(['建議今晚提早三十分鐘睡眠。']);
    expect(result.cautions).toEqual([]);
  });

  it('recognises the summary heading without displaying it as advice', () => {
    expect(summarizeImportedHealthAdvice('## 重點摘要\n睡眠資料尚未齊全。').summary)
      .toEqual(['睡眠資料尚未齊全。']);
  });

  it('returns empty groups for blank input', () => {
    expect(summarizeImportedHealthAdvice('  \n')).toEqual({
      summary: [],
      actions: [],
      cautions: []
    });
  });
});
