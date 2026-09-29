export interface ImportedHealthAdvice {
  id: string;
  source: 'chatgpt_health_manual' | 'chatgpt_health_shortcut';
  content: string;
  capturedAt?: string;
  createdAt: string;
}

export interface ImportedHealthAdviceResponse {
  advice: ImportedHealthAdvice[];
}
