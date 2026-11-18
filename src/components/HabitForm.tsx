import { useState } from 'react';
import type { FormEvent } from 'react';
import Modal from './Modal';
import { useData } from '../context/DataContext';
import { ALL_WEEKDAYS, PALETTE } from '../types';
import type { Habit } from '../types';
import { haptic } from '../lib/haptics';
import { WEEKDAYS_SHORT } from '../lib/dates';

interface Props {
  themeId: string;
  habit?: Habit;
  onClose: () => void;
}

export default function HabitForm({ themeId, habit, onClose }: Props) {
  const { createHabit, updateHabit, deleteHabit } = useData();

  const [title, setTitle] = useState(habit?.title ?? '');
  const [color, setColor] = useState(habit?.color ?? PALETTE[3]);
  const [weekdays, setWeekdays] = useState<number[]>(habit?.weekdays ?? ALL_WEEKDAYS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function toggleDay(day: number) {
    haptic(8);
    setWeekdays((cur) =>
      cur.includes(day)
        ? cur.filter((d) => d !== day)
        : [...cur, day].sort((a, b) => a - b),
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) {
      setError('Введи название привычки.');
      return;
    }
    if (weekdays.length === 0) {
      setError('Выбери хотя бы один день недели.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (habit) await updateHabit(habit.id, { title: clean, color, weekdays });
      else await createHabit(themeId, { title: clean, color, weekdays });
      haptic();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить привычку.');
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!habit) return;
    setBusy(true);
    setError(null);
    try {
      await deleteHabit(habit.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить привычку.');
      setBusy(false);
    }
  }

  return (
    <Modal title={habit ? 'Привычка' : 'Новая привычка'} onClose={onClose}>
      <form className="form" onSubmit={handleSubmit}>
        <label>
          Название
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Зарядка, чтение, прогулка…"
            maxLength={60}
            required
            autoFocus={!habit}
          />
        </label>

        <div className="field-label">Цвет в календаре</div>
        <div className="palette">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              className={`swatch${color === c ? ' active' : ''}`}
              style={{ background: c }}
              onClick={() => {
                haptic(8);
                setColor(c);
              }}
              aria-label={`Цвет ${c}`}
            />
          ))}
        </div>

        <div className="weekday-head">
          <span className="field-label">Повторять по дням</span>
          {weekdays.length < ALL_WEEKDAYS.length && (
            <button
              type="button"
              className="weekday-all"
              onClick={() => setWeekdays([...ALL_WEEKDAYS])}
            >
              Каждый день
            </button>
          )}
        </div>
        <div className="weekday-picker">
          {WEEKDAYS_SHORT.map((label, i) => {
            const day = i + 1;
            const active = weekdays.includes(day);
            return (
              <button
                key={day}
                type="button"
                className={`weekday-chip${active ? ' active' : ''}`}
                onClick={() => toggleDay(day)}
                aria-pressed={active}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="form-hint">
          Привычка будет появляться в чек-листе только в выбранные дни.
        </p>

        {habit && (
          <p className="form-hint">
            При удалении привычки пропадут и все её отметки в календаре.
          </p>
        )}

        {error && <div className="error">{error}</div>}

        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? 'Сохраняем…' : habit ? 'Сохранить' : 'Добавить привычку'}
        </button>

        {habit &&
          (confirmDelete ? (
            <div className="confirm-row">
              <span>Удалить привычку и все её отметки?</span>
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
              Удалить привычку
            </button>
          ))}
      </form>
    </Modal>
  );
}
