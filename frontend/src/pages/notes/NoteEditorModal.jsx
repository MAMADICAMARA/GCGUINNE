import { useState } from 'react';
import apiClient from '@/services/apiClient';

const COLORS = [
  { key: 'yellow', swatch: 'bg-amber-200' },
  { key: 'blue', swatch: 'bg-blue-200' },
  { key: 'green', swatch: 'bg-emerald-200' },
  { key: 'pink', swatch: 'bg-pink-200' },
  { key: 'gray', swatch: 'bg-slate-300' },
];

/**
 * Création/édition d'une note — `note` est `null` en création, l'objet
 * note existant en édition. Renvoie toujours l'état COMPLET du formulaire
 * au backend (pas de fusion partielle côté serveur), donc les champs sont
 * initialisés depuis la note existante puis toujours envoyés en entier.
 */
export default function NoteEditorModal({ note, onClose, onSaved }) {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [color, setColor] = useState(note?.color || 'yellow');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = { title: title.trim() || null, content: content.trim(), color };
      if (note) {
        await apiClient.put(`/notes/${note.id}`, payload);
      } else {
        await apiClient.post('/notes', payload);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Enregistrement impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">{note ? 'Modifier la note' : 'Nouvelle note'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5">
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          <label className="block text-sm font-medium text-slate-600 mb-1">Titre (optionnel)</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={150}
            placeholder="Ex : Fermeture exceptionnelle"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />

          <label className="block text-sm font-medium text-slate-600 mb-1">Contenu</label>
          <textarea
            required
            autoFocus
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            placeholder="Écrivez votre note..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />

          <label className="block text-sm font-medium text-slate-600 mb-2">Couleur</label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setColor(c.key)}
                aria-label={c.key}
                className={`w-8 h-8 rounded-full ${c.swatch} ${
                  color === c.key ? 'ring-2 ring-offset-2 ring-brand-500' : ''
                }`}
              />
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition disabled:opacity-60"
          >
            {submitting ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}
