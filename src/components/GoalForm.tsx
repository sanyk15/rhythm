import { useState } from 'react';
import type { FormEvent } from 'react';
import Modal from './Modal';
import { useData } from '../context/DataContext';
import type { Goal } from '../types';
import { monthLabel } from '../lib/dates';
import { haptic } from '../lib/haptics';

interface Props {
  themeId: string;
  month: string;
  goal?: Goal;
  onClose: () => void;
}

export default function GoalForm({ themeId, month, goal, onClose }: Props) {
  const { createGoal, updateGoal, deleteGoal } = useData();

  const [title, setTitle] = useState(goal?.title ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) {
      setError('Введи цель.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (goal) await updateGoal(goal.id, { title: clean });
      else await createGoal(themeId, month, clean);
      haptic();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить цель.');
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!goal) return;
    setBusy(true);
    setError(null);
    try {
      await deleteGoal(goal.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить цель.');
      setBusy(false);
    }
  }

  return (
    <Modal title={goal ? 'Цель' : `Новая цель · ${monthLabel(month)}`} onClose={onClose}>
      <form className="form" onSubmit={handleSubmit}>
        <label>
          Цель на месяц
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Прочитать книгу, сходить в кино…"
            maxLength={80}
            required
            autoFocus={!goal}
          />
        </label>

        <p className="form-hint">
          Цели привязаны к месяцу: переключи месяц в календаре, чтобы завести цели на
          другой.
        </p>

        {error && <div className="error">{error}</div>}

        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? 'Сохраняем…' : goal ? 'Сохранить' : 'Добавить цель'}
        </button>

        {goal &&
          (confirmDelete ? (
            <div className="confirm-row">
              <span>Удалить цель?</span>
              <div className="confirm-buttons">
                <button type="button" className="btn-ghost small" onClick={() => setConfirmDelete(false)}>
                  Отмена
                </button>
                <button type="button" className="btn-danger small" onClick={handleDelete} disabled={busy}>
                  Удалить
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn-danger-ghost" onClick={() => setConfirmDelete(true)}>
              Удалить цель
            </button>
          ))}
      </form>
    </Modal>
  );
}
