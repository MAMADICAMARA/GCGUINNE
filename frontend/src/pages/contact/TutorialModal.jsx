import { useEffect, useState } from 'react';
import { GraduationCap, ExternalLink } from 'lucide-react';
import apiClient from '@/services/apiClient';
import { getEmbeddableVideoUrl } from '@/utils/videoEmbed';

/**
 * Modal tutoriel (§36_tutoriel.sql, décidé en conversation) — vidéos
 * configurées par le Super Admin, jouées directement ici quand le lien est
 * reconnu (YouTube/Vimeo), sinon un simple lien de secours. Peut recevoir
 * les vidéos déjà chargées (déclenchement automatique, qui les a déjà
 * récupérées pour décider s'il fallait s'ouvrir) ou les charger lui-même
 * (ouverture à la demande depuis la page Contactez-nous).
 */
export default function TutorialModal({ videos: providedVideos, onClose }) {
  const [videos, setVideos] = useState(providedVideos || null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (providedVideos) return;
    (async () => {
      try {
        const { data } = await apiClient.get('/contact/tutorial');
        setVideos(data.videos);
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Impossible de charger le tutoriel.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeVideo = videos?.[activeIndex];
  const embedUrl = activeVideo ? getEmbeddableVideoUrl(activeVideo.url) : null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 shrink-0 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
              <GraduationCap size={18} strokeWidth={1.75} />
            </div>
            <h2 className="font-semibold text-slate-800">Tutoriel</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 min-h-0">
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          {!videos ? (
            <p className="text-sm text-slate-400 text-center py-10">Chargement...</p>
          ) : videos.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">
              Aucune vidéo tutoriel n'est configurée pour l'instant.
            </p>
          ) : (
            <div className="space-y-4">
              {videos.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {videos.map((v, i) => (
                    <button
                      key={v.id}
                      onClick={() => setActiveIndex(i)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                        i === activeIndex
                          ? 'bg-brand-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {v.title}
                    </button>
                  ))}
                </div>
              )}

              <div className="rounded-xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center">
                {embedUrl ? (
                  <iframe
                    key={embedUrl}
                    src={embedUrl}
                    title={activeVideo.title}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <a
                    href={activeVideo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-white text-sm font-medium bg-white/10 hover:bg-white/20 rounded-lg px-4 py-2.5 transition"
                  >
                    <ExternalLink size={16} />
                    Ouvrir "{activeVideo.title}"
                  </a>
                )}
              </div>

              {videos.length === 1 && <p className="text-sm text-slate-600">{activeVideo.title}</p>}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-100 text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-200 transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
