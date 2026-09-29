export interface ImportedHealthAdviceSummary {
  summary: string[];
  actions: string[];
  cautions: string[];
}

type AdviceSection = keyof ImportedHealthAdviceSummary;

const sectionHeadings: Record<AdviceSection, RegExp> = {
  summary: /^(?:總結|摘要|重點摘要|重點|分析|觀察|健康概況|主要發現)$/u,
  actions: /^(?:建議|行動|行動建議|今日建議|今天可做|下一步|改善建議)$/u,
  cautions: /^(?:注意|注意事項|安全提醒|警告|何時求助|就醫提醒)$/u
};

const actionWords = /(?:建議|可以|應該|優先|嘗試|保持|增加|減少|避免|安排|進行|補水|休息|提早|步行|散步|快走|運動|訓練|控制|記錄|量度)/u;
const cautionWords = /(?:注意|警告|不適|持續疲倦|持續疼痛|醫生|醫師|醫療|專業人員|急診|風險|立即求助)/u;

function cleanLine(value: string): string {
  return value
    .replace(/^\s{0,3}#{1,6}\s*/u, '')
    .replace(/^\s*(?:[-*•]|\d+[.)、])\s*/u, '')
    .replace(/[*_`]/gu, '')
    .trim();
}

function getHeading(value: string): AdviceSection | undefined {
  const normalized = cleanLine(value).replace(/[：:。]$/u, '').trim();
  return (Object.keys(sectionHeadings) as AdviceSection[]).find((key) =>
    sectionHeadings[key].test(normalized)
  );
}

function splitSentences(value: string): string[] {
  return value
    .split(/(?<=[。！？!?；;])|\n+/u)
    .map(cleanLine)
    .filter((line) => line.length >= 4);
}

function addUnique(target: string[], value: string): void {
  const normalized = cleanLine(value);
  if (!normalized || target.some((item) => item.localeCompare(normalized, 'zh-Hant') === 0)) return;
  target.push(normalized);
}

export function summarizeImportedHealthAdvice(content: string): ImportedHealthAdviceSummary {
  const result: ImportedHealthAdviceSummary = { summary: [], actions: [], cautions: [] };
  let currentSection: AdviceSection | undefined;

  for (const rawLine of content.split(/\r?\n/u)) {
    const heading = getHeading(rawLine);
    if (heading) {
      currentSection = heading;
      continue;
    }

    const line = cleanLine(rawLine);
    if (!line) continue;

    const labelled = line.match(/^([^：:]{1,12})[：:]\s*(.+)$/u);
    if (labelled) {
      const labelledSection = getHeading(labelled[1]);
      if (labelledSection) {
        currentSection = labelledSection;
        for (const sentence of splitSentences(labelled[2])) addUnique(result[labelledSection], sentence);
        continue;
      }
    }

    for (const sentence of splitSentences(line)) {
      if (currentSection) {
        addUnique(result[currentSection], sentence);
      } else if (cautionWords.test(sentence)) {
        addUnique(result.cautions, sentence);
      } else if (actionWords.test(sentence)) {
        addUnique(result.actions, sentence);
      } else {
        addUnique(result.summary, sentence);
      }
    }
  }

  return {
    summary: result.summary.slice(0, 3),
    actions: result.actions.slice(0, 3),
    cautions: result.cautions.slice(0, 2)
  };
}
