import { useEffect, useState } from 'react';
import { MessageCircleQuestion, Trash2 } from 'lucide-react';
import apiClient from '@/services/apiClient';
import { formatDateTime } from '@/utils/format';
import ContactMessageDetailModal from './ContactMessageDetailModal';

const ICON_OPTIONS = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'TELEGRAM', label: 'Telegram' },
  { value: 'PHONE', label: 'Téléphone' },
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'OTHER', label: 'Autre' },
];

export default function AdminContactMessagesPage() {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get('/admin/contact-messages', { params: { status } });
      setMessages(data.messages);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Impossible de charger les messages.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function handleRead(messageId) {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, status: 'READ' } : m)));
  }

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-1">
        <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <MessageCircleQuestion size={18} />
        </div>
        <h1 className="text-xl font-semibold text-slate-800">Messages</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">Messages envoyés depuis "Contactez-nous" par les boutiques.</p>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="ALL">Tous</option>
          <option value="NEW">Nouveaux</option>
          <option value="READ">Déjà lus</option>
        </select>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">{error}</p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden mb-6">
        {loading ? (
          <p className="px-4 py-6 text-center text-slate-400 text-sm">Chargement...</p>
        ) : messages.length === 0 ? (
          <p className="px-4 py-6 text-center text-slate-400 text-sm">Aucun message.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {messages.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMessage(m)}
                className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition"
              >
                <div className="min-w-0 flex items-center gap-2">
                  {m.status === 'NEW' && <span className="h-2 w-2 rounded-full bg-brand-500 shrink-0" />}
                  <div className="min-w-0">
                    <p className={`text-sm truncate ${m.status === 'NEW' ? 'font-semibold text-slate-800' : 'text-slate-700'}`}>
                      {m.subject}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {m.userName} {m.storeName ? `— ${m.storeName}` : ''}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-slate-400 shrink-0">{formatDateTime(m.createdAt)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <SocialLinksSection />
        <TutorialSection />
      </div>

      {selectedMessage && (
        <ContactMessageDetailModal
          message={selectedMessage}
          onClose={() => setSelectedMessage(null)}
          onRead={handleRead}
        />
      )}
    </div>
  );
}

/**
 * Gestion des liens "Rejoignez la communauté" (§ décidé en conversation) —
 * table générique (voir 34_contact_et_communaute.sql) : ajouter un réseau
 * plus tard se fait ici, sans jamais toucher au code.
 */
function SocialLinksSection() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  function emptyForm() {
    return { label: '', url: '', iconKey: 'OTHER', displayOrder: 0, isActive: true };
  }

  async function load() {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/admin/social-links');
      setLinks(data.links);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Impossible de charger les liens.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (expanded) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  function startEdit(link) {
    setEditingId(link.id);
    setForm({ label: link.label, url: link.url, iconKey: link.iconKey, displayOrder: link.displayOrder, isActive: link.isActive });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editingId) {
        await apiClient.put(`/admin/social-links/${editingId}`, form);
      } else {
        await apiClient.post('/admin/social-links', form);
      }
      cancelEdit();
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Supprimer ce lien ?')) return;
    try {
      await apiClient.delete(`/admin/social-links/${id}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Suppression impossible.');
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full text-left"
      >
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Liens "Rejoignez la communauté"</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            WhatsApp, Telegram et tout autre réseau affiché sur la page Contactez-nous des boutiques.
          </p>
        </div>
        <span className="text-slate-400 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          {loading ? (
            <p className="text-sm text-slate-400">Chargement...</p>
          ) : (
            <div className="space-y-2 mb-5">
              {links.length === 0 && <p className="text-sm text-slate-400">Aucun lien configuré pour l'instant.</p>}
              {links.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {link.label}{' '}
                      {!link.isActive && (
                        <span className="text-xs text-slate-400 font-normal">(désactivé)</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{link.url}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => startEdit(link)}
                      className="text-xs font-medium text-brand-500 hover:text-brand-600"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(link.id)}
                      className="text-slate-400 hover:text-red-600"
                      aria-label="Supprimer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Libellé</label>
              <input
                type="text"
                required
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Ex: Notre groupe WhatsApp"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Lien</label>
              <input
                type="text"
                required
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Icône</label>
              <select
                value={form.iconKey}
                onChange={(e) => setForm((f) => ({ ...f, iconKey: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {ICON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Ordre d'affichage</label>
              <input
                type="number"
                value={form.displayOrder}
                onChange={(e) => setForm((f) => ({ ...f, displayOrder: Number(e.target.value) }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {editingId && (
              <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                Lien actif (visible sur la page Contactez-nous)
              </label>
            )}

            <div className="sm:col-span-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition disabled:opacity-60"
              >
                {saving ? 'Enregistrement...' : editingId ? 'Mettre à jour' : 'Ajouter le lien'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  Annuler
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

/**
 * Vidéos tutoriel + réglages d'affichage automatique (§36_tutoriel.sql,
 * décidé en conversation). Les deux cases à cocher sont volontairement
 * indépendantes — jamais fusionnées en un seul réglage — l'une pour la
 * toute première connexion (après vérification d'e-mail), l'autre pour
 * chaque connexion normale ensuite.
 */
function TutorialSection() {
  const [videos, setVideos] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyVideoForm());
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  function emptyVideoForm() {
    return { title: '', url: '', displayOrder: 0, isActive: true };
  }

  async function load() {
    setLoading(true);
    try {
      const [videosRes, settingsRes] = await Promise.all([
        apiClient.get('/admin/tutorial-videos'),
        apiClient.get('/admin/tutorial-settings'),
      ]);
      setVideos(videosRes.data.videos);
      setSettings(settingsRes.data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Impossible de charger le tutoriel.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (expanded) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  function startEdit(video) {
    setEditingId(video.id);
    setForm({ title: video.title, url: video.url, displayOrder: video.displayOrder, isActive: video.isActive });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyVideoForm());
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editingId) {
        await apiClient.put(`/admin/tutorial-videos/${editingId}`, form);
      } else {
        await apiClient.post('/admin/tutorial-videos', form);
      }
      cancelEdit();
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Supprimer cette vidéo ?')) return;
    try {
      await apiClient.delete(`/admin/tutorial-videos/${id}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Suppression impossible.');
    }
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    setError('');
    try {
      const { data } = await apiClient.put('/admin/tutorial-settings', settings);
      setSettings(data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Enregistrement des réglages impossible.');
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full text-left"
      >
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Tutoriel</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Vidéos d'aide et déclenchement automatique après inscription / connexion.
          </p>
        </div>
        <span className="text-slate-400 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          {loading ? (
            <p className="text-sm text-slate-400">Chargement...</p>
          ) : (
            <>
              {settings && (
                <div className="rounded-lg bg-slate-50 border border-slate-100 px-4 py-3 mb-5 space-y-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={settings.showAfterSignup}
                      onChange={(e) => setSettings((s) => ({ ...s, showAfterSignup: e.target.checked }))}
                    />
                    Afficher automatiquement juste après l'inscription (vérification d'e-mail réussie)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={settings.showOnLogin}
                      onChange={(e) => setSettings((s) => ({ ...s, showOnLogin: e.target.checked }))}
                    />
                    Afficher automatiquement à chaque connexion normale
                  </label>
                  <button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="mt-1 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-60"
                  >
                    {savingSettings ? 'Enregistrement...' : 'Enregistrer ces réglages'}
                  </button>
                </div>
              )}

              <div className="space-y-2 mb-5">
                {videos.length === 0 && <p className="text-sm text-slate-400">Aucune vidéo configurée pour l'instant.</p>}
                {videos.map((video) => (
                  <div
                    key={video.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {video.title}{' '}
                        {!video.isActive && (
                          <span className="text-xs text-slate-400 font-normal">(désactivée)</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{video.url}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => startEdit(video)}
                        className="text-xs font-medium text-brand-500 hover:text-brand-600"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(video.id)}
                        className="text-slate-400 hover:text-red-600"
                        aria-label="Supprimer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Titre</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ex: Prendre en main la caisse"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Lien de la vidéo (YouTube ou Vimeo)</label>
              <input
                type="text"
                required
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Ordre d'affichage</label>
              <input
                type="number"
                value={form.displayOrder}
                onChange={(e) => setForm((f) => ({ ...f, displayOrder: Number(e.target.value) }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {editingId && (
              <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                Vidéo active (visible dans le modal tutoriel)
              </label>
            )}

            <div className="sm:col-span-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition disabled:opacity-60"
              >
                {saving ? 'Enregistrement...' : editingId ? 'Mettre à jour' : 'Ajouter la vidéo'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  Annuler
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
