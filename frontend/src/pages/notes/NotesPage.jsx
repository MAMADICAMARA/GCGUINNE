import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import { formatDateTime } from '@/utils/format';
import { useIsPlanFrozen } from '@/store/authStore';
import NoteEditorModal from './NoteEditorModal';

/**
 * Bloc-note partagé de la boutique (§19_notes_boutique.sql) — carnet libre
 * sur l'activité de la boutique, ouvert à toute l'équipe (Owner, Vendeur),
 * pas seulement à l'Owner. N'importe quel membre peut créer,
 * modifier, épingler ou supprimer n'importe quelle note.
 */
const COLOR_STYLES = {
  yellow: 'bg-amber-50 border-amber-200',
  blue: 'bg-blue-50 border-blue-200',
  green: 'bg-emerald-50 border-emerald-200',
  pink: 'bg-pink-50 border-pink-200',
  gray: 'bg-slate-100 border-slate-200',
};

export default function NotesPage() {
  const isFrozen = useIsPlanFrozen();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editingNote, setEditingNote] = useState(null); // null = fermé, {} = création, {...} = édition
  const [busyId, setBusyId] = useState(null);

  async function loadNotes() {
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get('/notes', { params: { search: search || undefined } });
      setNotes(data.notes);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Impossible de charger les notes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(loadNotes, search ? 250 : 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleTogglePin(note) {
    setBusyId(note.id);
    try {
      await apiClient.post(`/notes/${note.id}/toggle-pin`);
      loadNotes();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Action impossible.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(note) {
    if (!window.confirm('Supprimer cette note ? Cette action est irréversible.')) return;
    setBusyId(note.id);
    try {
      await apiClient.delete(`/notes/${note.id}`);
      loadNotes();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Suppression impossible.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Notes</h1>
          <p className="text-sm text-slate-500">
            Bloc-note partagé de la boutique — visible par toute l'équipe.
          </p>
        </div>
        <button
          onClick={() => setEditingNote({})}
          disabled={isFrozen}
          title={isFrozen ? 'Boutique en mode gratuit — action indisponible' : undefined}
          className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition self-start sm:self-auto disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Nouvelle note
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher dans les notes..."
        className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm mb-6 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />

      {loading ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : notes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          {search ? 'Aucune note ne correspond à votre recherche.' : 'Aucune note pour l\'instant.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map((note) => (
            <div
              key={note.id}
              className={`rounded-xl border p-4 flex flex-col ${COLOR_STYLES[note.color] || COLOR_STYLES.yellow}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                {note.title ? (
                  <h3 className="font-semibold text-slate-800 wrap-break-word">{note.title}</h3>
                ) : (
                  <span />
                )}
                <button
                  onClick={() => handleTogglePin(note)}
                  disabled={busyId === note.id || isFrozen}
                  title={
                    isFrozen
                      ? 'Boutique en mode gratuit — action indisponible'
                      : note.isPinned
                        ? 'Désépingler'
                        : 'Épingler'
                  }
                  className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs leading-none transition disabled:opacity-40 ${
                    note.isPinned
                      ? 'bg-slate-700'
                      : 'bg-transparent opacity-30 grayscale hover:opacity-70 hover:grayscale-0'
                  }`}
                >
                  📌
                </button>
              </div>

              <p className="text-sm text-slate-700 whitespace-pre-wrap wrap-break-word flex-1 mb-3">
                {note.content}
              </p>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-black/5">
                <span>
                  {note.authorName ? `${note.authorName} · ` : ''}
                  {formatDateTime(note.updatedAt)}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingNote(note)}
                    disabled={isFrozen}
                    title={isFrozen ? 'Boutique en mode gratuit — action indisponible' : undefined}
                    className="font-medium text-slate-500 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => handleDelete(note)}
                    disabled={busyId === note.id || isFrozen}
                    title={isFrozen ? 'Boutique en mode gratuit — action indisponible' : undefined}
                    className="font-medium text-slate-400 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingNote && (
        <NoteEditorModal
          note={editingNote.id ? editingNote : null}
          onClose={() => setEditingNote(null)}
          onSaved={() => {
            setEditingNote(null);
            loadNotes();
          }}
        />
      )}
    </div>
  );
}
