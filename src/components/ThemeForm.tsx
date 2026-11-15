import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { PALETTE } from '../types';
import type { Theme } from '../types';
import { shade } from '../lib/colors';
import { deleteThemePhoto, uploadThemePhoto } from '../lib/storage';
import { haptic } from '../lib/haptics';

interface Props {
  theme?: Theme;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onCreated?: (id: string) => void;
  onClose: () => void;
}

export default function ThemeForm({
  theme,
  canMoveLeft,
  canMoveRight,
  onCreated,
  onClose,
}: Props) {
  const { createTheme, updateTheme, moveTheme, deleteTheme } = useData();
  const { user } = useAuth();

  const [title, setTitle] = useState(theme?.title ?? '');
  const [accent, setAccent] = useState(theme?.accent ?? PALETTE[0]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(theme?.photoUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;

    setUploading(true);
    setError(null);
    try {
      const url = await uploadThemePhoto(user.id, file);
      setPhotoUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить фото.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) {
      setError('Введи название темы.');
      return;
    }
    if (uploading) {
      setError('Подожди, фото ещё загружается.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (theme) {
        await updateTheme(theme.id, { title: clean, accent, photoUrl });
        if (theme.photoUrl && theme.photoUrl !== photoUrl) void deleteThemePhoto(theme.photoUrl);
      } else {
        const created = await createTheme({ title: clean, accent, photoUrl });
        onCreated?.(created.id);
      }
      haptic();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить тему.');
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!theme) return;
    setBusy(true);
    setError(null);
    try {
      await deleteTheme(theme.id);
      if (theme.photoUrl) void deleteThemePhoto(theme.photoUrl);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить тему.');
      setBusy(false);
    }
  }

  return (
    <Modal title={theme ? 'Тема' : 'Новая тема'} onClose={onClose}>
      <form className="form" onSubmit={handleSubmit}>
        <div
          className="photo-preview"
          style={{
            background: photoUrl
              ? undefined
              : `linear-gradient(150deg, ${accent}, ${shade(accent, 0.5)})`,
          }}
        >
          {photoUrl && <img src={photoUrl} alt="" />}
          {!photoUrl && <span className="photo-hint">Без фото будет градиент</span>}
        </div>

        <div className="photo-actions">
          <label className={`btn-ghost${uploading ? ' disabled' : ''}`}>
            {uploading ? 'Загружаем…' : photoUrl ? 'Заменить фото' : 'Выбрать фото'}
            <input type="file" accept="image/*" onChange={handleFile} hidden disabled={uploading} />
          </label>
          {photoUrl && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setPhotoUrl(null)}
              disabled={uploading}
            >
              Убрать
            </button>
          )}
        </div>

        <label>
          Название
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Семья, Дом, Работа…"
            maxLength={40}
            required
            autoFocus={!theme}
          />
        </label>

        <div className="field-label">Цвет</div>
        <div className="palette">
          {PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              className={`swatch${accent === color ? ' active' : ''}`}
              style={{ background: color }}
              onClick={() => {
                haptic(8);
                setAccent(color);
              }}
              aria-label={`Цвет ${color}`}
            />
          ))}
        </div>

        {error && <div className="error">{error}</div>}

        <button className="btn-primary" type="submit" disabled={busy || uploading}>
          {busy ? 'Сохраняем…' : theme ? 'Сохранить' : 'Создать тему'}
        </button>

        {theme && (
          <>
            <div className="move-row">
              <span className="field-label">Порядок</span>
              <div className="move-buttons">
                <button
                  type="button"
                  className="btn-ghost small"
                  onClick={() => void moveTheme(theme.id, -1).catch(() => {})}
                  disabled={!canMoveLeft}
                >
                  ← Раньше
                </button>
                <button
                  type="button"
                  className="btn-ghost small"
                  onClick={() => void moveTheme(theme.id, 1).catch(() => {})}
                  disabled={!canMoveRight}
                >
                  Позже →
                </button>
              </div>
            </div>

            {confirmDelete ? (
              <div className="confirm-row">
                <span>Удалить тему со всеми привычками и целями?</span>
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
              <button
                type="button"
                className="btn-danger-ghost"
                onClick={() => setConfirmDelete(true)}
              >
                Удалить тему
              </button>
            )}
          </>
        )}
      </form>
    </Modal>
  );
}
