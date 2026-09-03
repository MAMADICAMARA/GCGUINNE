import { useEffect, useRef, useState } from 'react';
import {
  Download,
  ExternalLink,
  Plus,
  Rocket,
  Smartphone,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import apiClient from '@/services/apiClient';

const UPDATE_LEVEL_OPTIONS = [
  { value: 'OPTIONAL', label: 'Optionnel', description: 'Badge discret sur Paramètres — app pleinement utilisable.' },
  { value: 'RECOMMENDED', label: 'Recommandée', description: "Bandeau visible — l'app reste totalement utilisable." },
  { value: 'MANDATORY', label: 'Obligatoire', description: 'Écran bloquant — rien accessible sans mettre à jour.' },
];

const UPDATE_LEVEL_BADGE = {
  OPTIONAL: 'bg-slate-100 text-slate-600',
  RECOMMENDED: 'bg-amber-100 text-amber-700',
  MANDATORY: 'bg-red-100 text-red-700',
};

/**
 * Versions de l'app mobile (§ cahier des charges "Système de notification
 * de mise à jour", décidé en conversation) — l'app est distribuée en APK
 * direct (hors Play Store), ce système remplace le mécanisme de mise à
 * jour automatique qu'un store fournirait normalement.
 *
 * Une version publiée SANS AUCUN lien reste invisible pour l'app et pour
 * /telecharger (cf. appVersions.service.js#getLatestVersion) — c'est
 * pourquoi chaque carte d'historique permet d'ajouter un lien
 * immédiatement après la création, plutôt que de considérer la
 * publication comme terminée à la seule création de la ligne.
 */
export default function AdminAppVersionsPage() {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  async function loadVersions() {
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get('/admin/app-versions');
      setVersions(data.versions);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Impossible de charger les versions.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVersions();
  }, []);

  function flashSuccess(message) {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 5000);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Smartphone size={18} />
          </div>
          <h1 className="text-xl font-semibold text-slate-800">Versions de l'app</h1>
        </div>
        <button
          onClick={() => setShowCreateForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition"
        >
          {showCreateForm ? <X size={16} /> : <Plus size={16} />}
          {showCreateForm ? 'Annuler' : 'Publier une nouvelle version'}
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Distribution APK directe (hors Play Store) — notifie les utilisateurs déjà installés qu'une
        mise à jour existe.
      </p>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">{error}</p>
      )}
      {successMessage && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2 mb-4">
          {successMessage}
        </p>
      )}

      {showCreateForm && (
        <CreateVersionForm
          onClose={() => setShowCreateForm(false)}
          onCreated={() => {
            setShowCreateForm(false);
            flashSuccess('Version créée — ajoutez maintenant au moins un lien de téléchargement pour la publier réellement.');
            loadVersions();
          }}
        />
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : versions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
          Aucune version publiée pour l'instant.
        </div>
      ) : (
        <div className="space-y-4">
          {versions.map((version) => (
            <VersionCard
              key={version.id}
              version={version}
              onLinkAdded={(link) => {
                setVersions((prev) =>
                  prev.map((v) => (v.id === version.id ? { ...v, links: [...v.links, link] } : v))
                );
                flashSuccess('Lien ajouté.');
              }}
              onLinkRemoved={(linkId) => {
                setVersions((prev) =>
                  prev.map((v) =>
                    v.id === version.id ? { ...v, links: v.links.filter((l) => l.id !== linkId) } : v
                  )
                );
                flashSuccess('Lien retiré.');
              }}
              onError={setError}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CreateVersionForm({ onClose, onCreated }) {
  const [platform, setPlatform] = useState('android');
  const [versionCode, setVersionCode] = useState('');
  const [versionName, setVersionName] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [updateLevel, setUpdateLevel] = useState('OPTIONAL');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await apiClient.post('/admin/app-versions', {
        platform,
        versionCode: Number(versionCode),
        versionName: versionName.trim(),
        releaseNotes: releaseNotes.trim() || undefined,
        updateLevel,
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Publication impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 mb-6">
      <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-1.5">
        <Rocket size={15} className="text-brand-500" />
        Nouvelle version
      </h2>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Plateforme</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="android">Android</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            Numéro de version (code, entier croissant)
          </label>
          <input
            required
            type="number"
            min="1"
            step="1"
            value={versionCode}
            onChange={(e) => setVersionCode(e.target.value)}
            placeholder="Ex : 13"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-600 mb-1">
          Nom de version (affiché à l'utilisateur)
        </label>
        <input
          required
          value={versionName}
          onChange={(e) => setVersionName(e.target.value)}
          placeholder="Ex : 1.3.0"
          className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-600 mb-1">
          Notes de version ("Quoi de neuf")
        </label>
        <textarea
          rows={3}
          value={releaseNotes}
          onChange={(e) => setReleaseNotes(e.target.value)}
          placeholder="Ex : Correction d'un bug d'affichage, amélioration des performances..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div className="mb-5">
        <label className="block text-sm font-medium text-slate-600 mb-2">Niveau d'insistance</label>
        <div className="grid sm:grid-cols-3 gap-2.5">
          {UPDATE_LEVEL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setUpdateLevel(opt.value)}
              className={`text-left rounded-xl border p-3 transition ${
                updateLevel === opt.value
                  ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className="text-sm font-semibold text-slate-800">{opt.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-500 text-white text-sm font-medium px-5 py-2.5 hover:bg-brand-600 transition disabled:opacity-60"
        >
          {submitting ? 'Création...' : 'Créer cette version'}
        </button>
        <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">
          Annuler
        </button>
      </div>
    </form>
  );
}

function VersionCard({ version, onLinkAdded, onLinkRemoved, onError }) {
  const [showAddLink, setShowAddLink] = useState(false);
  const isPublished = version.links.length > 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-800">
              {version.platform} · {version.versionName}
            </span>
            <span className="text-xs text-slate-400">(code {version.versionCode})</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${UPDATE_LEVEL_BADGE[version.updateLevel]}`}>
              {UPDATE_LEVEL_OPTIONS.find((o) => o.value === version.updateLevel)?.label}
            </span>
            {!isPublished && (
              <span className="rounded-full bg-slate-100 text-slate-500 px-2.5 py-0.5 text-xs font-medium">
                Brouillon — aucun lien
              </span>
            )}
          </div>
          {version.releaseNotes && <p className="text-sm text-slate-500 mt-1.5">{version.releaseNotes}</p>}
          <p className="text-xs text-slate-400 mt-1">
            Publiée le {new Date(version.publishedAt).toLocaleString('fr-FR')}
          </p>
        </div>
        <button
          onClick={() => setShowAddLink((v) => !v)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium px-3 py-2 hover:bg-slate-200 transition"
        >
          <Plus size={14} />
          Ajouter une source
        </button>
      </div>

      {version.links.length > 0 && (
        <div className="space-y-2 mb-2">
          {version.links.map((link) => (
            <div
              key={link.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                {link.isDirectUpload ? (
                  <Download size={14} className="text-brand-500 shrink-0" />
                ) : (
                  <ExternalLink size={14} className="text-slate-400 shrink-0" />
                )}
                <span className="text-sm font-medium text-slate-700 shrink-0">{link.label}</span>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-slate-400 truncate hover:underline"
                >
                  {link.url}
                </a>
              </div>
              <button
                onClick={async () => {
                  if (!window.confirm(`Retirer le lien "${link.label}" ?`)) return;
                  try {
                    await apiClient.delete(`/admin/app-versions/${version.id}/links/${link.id}`);
                    onLinkRemoved(link.id);
                  } catch (err) {
                    onError(err.response?.data?.error?.message || 'Suppression impossible.');
                  }
                }}
                className="shrink-0 text-slate-400 hover:text-red-600 transition"
                aria-label="Retirer ce lien"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAddLink && (
        <AddLinkForm
          versionId={version.id}
          onClose={() => setShowAddLink(false)}
          onLinkAdded={(link) => {
            onLinkAdded(link);
            setShowAddLink(false);
          }}
        />
      )}
    </div>
  );
}

function AddLinkForm({ versionId, onClose, onLinkAdded }) {
  const [mode, setMode] = useState('link'); // 'link' | 'upload'
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  async function handleSubmitLink(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await apiClient.post(`/admin/app-versions/${versionId}/links`, {
        label: label.trim(),
        url: url.trim(),
      });
      onLinkAdded(data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Ajout impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitUpload(e) {
    e.preventDefault();
    setError('');
    if (!file) {
      setError('Sélectionnez un fichier .apk.');
      return;
    }
    setSubmitting(true);
    setProgress(0);
    try {
      const formData = new FormData();
      formData.append('appVersionId', versionId);
      formData.append('label', label.trim() || 'Téléchargement direct');
      formData.append('apk', file);
      const { data } = await apiClient.post('/admin/app-versions/upload-apk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100));
        },
      });
      onLinkAdded(data);
    } catch (err) {
      setError(err.response?.data?.error?.message || "L'envoi a échoué.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mt-2">
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setMode('link')}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            mode === 'link' ? 'bg-brand-500 text-white' : 'bg-white text-slate-600 border border-slate-200'
          }`}
        >
          Lien externe
        </button>
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            mode === 'upload' ? 'bg-brand-500 text-white' : 'bg-white text-slate-600 border border-slate-200'
          }`}
        >
          Envoyer un fichier APK
        </button>
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {mode === 'link' ? (
        <form onSubmit={handleSubmitLink} className="space-y-2.5">
          <input
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Libellé (ex : Google Drive, Mega, Uptodown...)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-brand-500 text-white text-xs font-semibold px-4 py-2 hover:bg-brand-600 transition disabled:opacity-60"
            >
              {submitting ? 'Ajout...' : 'Ajouter ce lien'}
            </button>
            <button type="button" onClick={onClose} className="text-xs text-slate-500 hover:text-slate-700">
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSubmitUpload} className="space-y-2.5">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Libellé (optionnel — par défaut « Téléchargement direct »)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            ref={fileInputRef}
            required
            type="file"
            accept=".apk"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700"
          />
          <p className="text-xs text-slate-400">Fichier .apk uniquement, 250 Mo maximum — l'envoi peut prendre plusieurs minutes.</p>
          {submitting && (
            <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 text-white text-xs font-semibold px-4 py-2 hover:bg-brand-600 transition disabled:opacity-60"
            >
              <Upload size={13} />
              {submitting ? `Envoi... ${progress}%` : 'Envoyer le fichier'}
            </button>
            <button type="button" onClick={onClose} className="text-xs text-slate-500 hover:text-slate-700">
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
