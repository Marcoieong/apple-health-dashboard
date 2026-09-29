import { z } from 'zod';

export const importedHealthAdviceSource = 'chatgpt_health_manual' as const;
export const shortcutImportedHealthAdviceSource =
  'chatgpt_health_shortcut' as const;
export const importedHealthAdviceSources = [
  importedHealthAdviceSource,
  shortcutImportedHealthAdviceSource
] as const;

export type ImportedHealthAdviceSource =
  (typeof importedHealthAdviceSources)[number];

export const createImportedHealthAdviceSchema = z.object({
  content: z.string().trim().min(1).max(4000)
});

export const createShortcutImportedHealthAdviceSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  request_id: z
    .string()
    .trim()
    .min(16)
    .max(128)
    .regex(/^[A-Za-z0-9._:-]+$/),
  captured_at: z.iso.datetime({ offset: true }).optional()
});

export const deleteImportedHealthAdviceSchema = z.object({
  id: z.string().uuid()
});

export interface ImportedHealthAdviceItem {
  id: string;
  source: ImportedHealthAdviceSource;
  content: string;
  capturedAt?: string;
  createdAt: string;
}
