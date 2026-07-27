import { Download, FileJson, Plus, Save, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { todayKey } from '../../lib/date';
import type {
  DailyHealthRecord,
  DataImportResult,
  HealthRecordInput,
} from '../../models/health';
import { downloadCsv, downloadJson } from '../../services/export';

interface DataEntryProps {
  records: DailyHealthRecord[];
  error: string | null;
  initialRecordId?: string;
  onClearError: () => void;
  onSave: (input: HealthRecordInput, id?: string) => boolean;
  onDelete: (id: string) => boolean;
  onClear: () => boolean;
  onImport: (json: string) => DataImportResult;
}

const blankInput = (date = todayKey()): HealthRecordInput => ({
  date,
  strengthTraining: false,
  lunchHighProtein: false,
  dinnerHighProtein: false,
  vegetablesCompleted: false,
  noSugaryDrink: false,
  noLateNightMeal: false,
  notes: '',
});

const numberFields = [
  ['steps', '步數', '步', '1'],
  ['activeCalories', '活動卡路里', 'kcal', '1'],
  ['exerciseMinutes', '運動分鐘', '分鐘', '1'],
  ['sleepHours', '睡眠時數', '小時', '0.25'],
  ['weightKg', '體重', 'kg', '0.1'],
  ['bodyFatPercent', '體脂率', '%', '0.1'],
  ['waistCm', '腰圍', 'cm', '0.1'],
] as const;

const habitFields = [
  ['strengthTraining', '完成力量訓練'],
  ['lunchHighProtein', '午餐高蛋白'],
  ['dinnerHighProtein', '晚餐高蛋白'],
  ['vegetablesCompleted', '有足夠蔬菜'],
  ['noSugaryDrink', '沒有含糖飲料'],
  ['noLateNightMeal', '沒有吃宵夜'],
] as const;

function recordToInput(record: DailyHealthRecord): HealthRecordInput {
  return {
    date: record.date,
    steps: record.steps,
    activeCalories: record.activeCalories,
    exerciseMinutes: record.exerciseMinutes,
    sleepHours: record.sleepHours,
    weightKg: record.weightKg,
    bodyFatPercent: record.bodyFatPercent,
    waistCm: record.waistCm,
    strengthTraining: record.strengthTraining,
    lunchHighProtein: record.lunchHighProtein,
    dinnerHighProtein: record.dinnerHighProtein,
    vegetablesCompleted: record.vegetablesCompleted,
    noSugaryDrink: record.noSugaryDrink,
    noLateNightMeal: record.noLateNightMeal,
    notes: record.notes,
  };
}

export function DataEntry({
  records,
  error,
  initialRecordId,
  onClearError,
  onSave,
  onDelete,
  onClear,
  onImport,
}: DataEntryProps) {
  const [editingId, setEditingId] = useState<string | undefined>(initialRecordId);
  const [form, setForm] = useState<HealthRecordInput>(() => {
    const initial = records.find((record) => record.id === initialRecordId);
    return initial ? recordToInput(initial) : blankInput();
  });
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => b.date.localeCompare(a.date)),
    [records],
  );

  useEffect(() => {
    if (!initialRecordId) return;
    const record = records.find((item) => item.id === initialRecordId);
    if (record) {
      setEditingId(record.id);
      setForm(recordToInput(record));
    }
  }, [initialRecordId, records]);

  const startNew = () => {
    setEditingId(undefined);
    setForm(blankInput());
    setMessage(null);
    onClearError();
  };

  const selectRecord = (id: string) => {
    if (!id) return startNew();
    const record = records.find((item) => item.id === id);
    if (record) {
      setEditingId(id);
      setForm(recordToInput(record));
      setMessage(null);
      onClearError();
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const wasEditing = Boolean(editingId);
    if (onSave(form, editingId)) {
      setMessage(wasEditing ? '紀錄已更新並儲存在本機。' : '紀錄已新增並儲存在本機。');
      if (!wasEditing) {
        setEditingId(undefined);
        setForm(blankInput());
      }
    }
  };

  const handleImport = async (file?: File) => {
    if (!file) return;
    const result = onImport(await file.text());
    setMessage(
      result.importedCount
        ? `已匯入 ${result.importedCount} 筆，略過 ${result.skippedCount} 筆。`
        : '沒有匯入任何紀錄。',
    );
    if (fileInput.current) fileInput.current.value = '';
  };

  return (
    <div className="page-stack">
      <section className="page-intro entry-intro">
        <div>
          <p className="eyebrow">本機手動紀錄</p>
          <h2>數據輸入</h2>
          <p>資料只存在這部裝置；ChatGPT 產生的 JSON 也可在此匯入。建議定期備份。</p>
        </div>
        <button className="primary-button" type="button" onClick={startNew}>
          <Plus size={18} /> 新增紀錄
        </button>
      </section>

      <section className="data-toolbar" aria-label="資料管理">
        <label>
          <span>編輯已有紀錄</span>
          <select
            value={editingId ?? ''}
            onChange={(event) => selectRecord(event.target.value)}
            aria-label="選擇已有紀錄"
          >
            <option value="">新增紀錄</option>
            {sortedRecords.map((record) => (
              <option key={record.id} value={record.id}>
                {record.date} · {record.source === 'demo' ? 'Demo' : '個人紀錄'}
              </option>
            ))}
          </select>
        </label>
        <div className="toolbar-actions">
          <button type="button" onClick={() => downloadJson(records)} disabled={!records.length}>
            <FileJson size={17} /> 匯出 JSON
          </button>
          <button type="button" onClick={() => downloadCsv(records)} disabled={!records.length}>
            <Download size={17} /> 匯出 CSV
          </button>
          <button type="button" onClick={() => fileInput.current?.click()}>
            <Upload size={17} /> 匯入 JSON
          </button>
          <input
            ref={fileInput}
            className="visually-hidden"
            type="file"
            accept="application/json,.json"
            onChange={(event) => void handleImport(event.target.files?.[0])}
          />
        </div>
      </section>

      {(message || error) && (
        <div className={error ? 'form-message error' : 'form-message'} role="status" aria-live="polite">
          {error ?? message}
        </div>
      )}

      <form className="entry-form" onSubmit={handleSubmit}>
        <section className="form-section">
          <div className="form-section-heading">
            <span>01</span>
            <div><h3>活動與身體數據</h3><p>未有數據的欄位可留空。</p></div>
          </div>
          <div className="field-grid">
            <label className="full-field">
              <span>日期</span>
              <input
                required
                type="date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
            </label>
            {numberFields.map(([field, label, unit, step]) => (
              <label key={field}>
                <span>{label}</span>
                <div className="unit-input">
                  <input
                    type="number"
                    min="0"
                    step={step}
                    inputMode="decimal"
                    value={form[field] ?? ''}
                    onChange={(event) => setForm({
                      ...form,
                      [field]: event.target.value === '' ? undefined : Number(event.target.value),
                    })}
                  />
                  <span>{unit}</span>
                </div>
              </label>
            ))}
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-heading">
            <span>02</span>
            <div><h3>飲食與訓練習慣</h3><p>勾選今天已完成的項目。</p></div>
          </div>
          <div className="check-grid">
            {habitFields.map(([field, label]) => (
              <label className="check-option" key={field}>
                <input
                  type="checkbox"
                  checked={Boolean(form[field])}
                  onChange={(event) => setForm({ ...form, [field]: event.target.checked })}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-heading">
            <span>03</span>
            <div><h3>備註</h3><p>可記下用餐、活動或作息情況。</p></div>
          </div>
          <label>
            <span className="visually-hidden">備註</span>
            <textarea
              rows={4}
              maxLength={500}
              placeholder="例如：晚飯後在南灣湖快走 20 分鐘"
              value={form.notes ?? ''}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </label>
        </section>

        <div className="form-actions">
          {editingId && (
            <button
              className="danger-button"
              type="button"
              onClick={() => {
                if (window.confirm('確定刪除這筆紀錄？') && onDelete(editingId)) {
                  startNew();
                  setMessage('紀錄已刪除。');
                }
              }}
            >
              <Trash2 size={18} /> 刪除
            </button>
          )}
          <button className="primary-button" type="submit">
            <Save size={18} /> {editingId ? '儲存變更' : '儲存紀錄'}
          </button>
        </div>
      </form>

      <section className="danger-zone">
        <div>
          <h3>清除本機資料</h3>
          <p>此操作會刪除所有 Demo 與個人紀錄。請先匯出 JSON 備份。</p>
        </div>
        <button
          className="danger-button"
          type="button"
          disabled={!records.length && !error}
          onClick={() => {
            if (window.confirm('確定清除這部裝置上的全部健康紀錄？此操作無法復原。') && onClear()) {
              startNew();
              setMessage('本機資料已清除。');
            }
          }}
        >
          清除全部
        </button>
      </section>
    </div>
  );
}
