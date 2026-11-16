import { useState } from 'react';
import type { FormEvent } from 'react';
import Modal from './Modal';
import { useData } from '../context/DataContext';
import { dayTitle } from '../lib/dates';
import { haptic } from '../lib/haptics';
import type { DayTask } from '../types';

interface Props {
  date: string;
  task?: DayTask;
  onClose: () => void;
}

export default function DayTaskForm({ date, task, onClose }: Props) {
  const { createDayTask, updateDayTask, deleteDayTask } = useData();

  const [title, setTitle] = useState(task?.title ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) {
      setError('Введи задачу.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (task) await updateDayTask(task.id, { title: clean });
      else await createDayTask(date, clean);
      haptic();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить задачу.');
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!task) return;
    setBusy(true);
    setError(null);
    try {
      await deleteDayTask(task.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить задачу.');
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`${task ? 'Задача' : 'Новая задача'} · ${dayTitle(date)}`}
      onClose={onClose}
    >
      <form className="form" onSubmit={handleSubmit}>
        <label>
          Дело на день
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Купить хлеб, позвонить маме…"
            maxLength={100}
            required
            autoFocus={!task}
          />
        </label>

        <p className="form-hint">
          Задача — разовое дело только на этот день. Привычки из «Тем» повторяются каждый
          день.
        </p>

        {error && <div className="error">{error}</div>}

        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? 'Сохраняем…' : task ? 'Сохранить' : 'Добавить задачу'}
        </button>

        {task &&
          (confirmDelete ? (
            <div className="confirm-row">
              <span>Удалить задачу?</span>
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
              Удалить задачу
            </button>
          ))}
      </form>
    </Modal>
  );
}
