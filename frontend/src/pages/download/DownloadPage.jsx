import { useEffect, useState } from 'react';
import { Download, ExternalLink, Info, Smartphone } from 'lucide-react';
import apiClient from '@/services/apiClient';

/**
 * Page publique de téléchargement (§9 du cahier des charges "Système de
 * notification de mise à jour", décidé en conversation) — route
 * volontairement PUBLIQUE (comme /marche) : le navigateur externe ouvert
 * depuis l'app mobile n'a aucune connaissance de la session utilisateur,
 * et ce lien doit rester partageable (WhatsApp) sans compte.
 *
 * Interroge EXACTEMENT le même endpoint que l'app Flutter
 * (GET /app/version) — jamais une seconde valeur codée séparément, pour
 * ne jamais risquer une désynchronisation entre ce que l'app annonce et
 * ce que cette page propose de télécharger.
 */
export default function DownloadPage() {
  const [version, setVersion] = useState(undefined); // undefined = chargement, null = aucune version
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .get('/app/version', { params: { platform: 'android' } })
      // `{}` (objet vide) quand aucune version n'est publiée — jamais un
      // `null` racine (cf. appVersions.public.routes.js) — détecté ici par
      // l'absence de `versionCode`.
      .then(({ data }) => setVersion(data && data.versionCode ? data : null))
      .catch((err) => setError(err.response?.data?.error?.message || 'Impossible de charger la version disponible.'));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-brand-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
            GC
          </div>
          <div>
            <p className="font-semibold text-slate-800 leading-tight">Gestion Commerciale</p>
            <p className="text-xs text-slate-400 leading-tight">Télécharger l'application mobile</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-2 mb-5">
          <Smartphone className="h-5 w-5 text-brand-500" strokeWidth={1.75} />
          <h1 className="text-xl font-semibold text-slate-800">Application Android</h1>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 mb-4">{error}</p>
        )}

        {version === undefined && !error && (
          <p className="text-sm text-slate-400 text-center py-12">Chargement...</p>
        )}

        {version === null && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 px-6 text-center">
            <p className="text-slate-600 font-medium">Aucune version disponible pour l'instant.</p>
            <p className="text-sm text-slate-400 mt-1">Revenez bientôt.</p>
          </div>
        )}

        {version && (
          <>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm mb-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-semibold text-slate-800">Version {version.versionName}</h2>
              </div>
              {version.releaseNotes && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                    Quoi de neuf
                  </p>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{version.releaseNotes}</p>
                </div>
              )}
            </div>

            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2.5">
              Choisissez une source de téléchargement
            </p>
            <div className="space-y-2.5 mb-8">
              {version.links.map((link) => (
                <a
                  key={link.label + link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-sm hover:shadow-md hover:border-brand-300 transition"
                >
                  <span className="flex items-center gap-2.5">
                    {link.isDirectUpload ? (
                      <Download size={16} className="text-brand-500 shrink-0" />
                    ) : (
                      <ExternalLink size={16} className="text-slate-400 shrink-0" />
                    )}
                    <span className="text-sm font-medium text-slate-800">{link.label}</span>
                  </span>
                  <span className="text-xs text-brand-500 font-medium shrink-0">Télécharger</span>
                </a>
              ))}
            </div>

            <div className="rounded-xl bg-slate-100 p-4 flex gap-3">
              <Info size={16} className="text-slate-500 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-600 leading-relaxed">
                <p className="font-medium text-slate-700 mb-1">
                  Comment installer une application hors Play Store
                </p>
                <p>
                  Après le téléchargement, ouvrez le fichier <span className="font-mono">.apk</span>. Si
                  Android affiche un avertissement, appuyez sur <span className="font-medium">« Paramètres »</span>{' '}
                  puis autorisez <span className="font-medium">« Installer des applications inconnues »</span> pour
                  l'application utilisée (navigateur ou gestionnaire de fichiers), puis relancez
                  l'installation.
                </p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
