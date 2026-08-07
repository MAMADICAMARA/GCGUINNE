import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import apiClient from '@/services/apiClient';

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp';

/**
 * Bouton "Envoyer une image" réutilisable (§ cahier des charges "Upload et
 * stockage réel des images", décidé en conversation) — envoie le fichier à
 * POST /uploads/image, puis remonte l'URL publique obtenue au parent via
 * `onUploaded`, exactement comme si l'utilisateur avait collé ce lien
 * lui-même dans le champ existant. Ne remplace jamais ce champ — coexiste
 * à côté, décision explicite du cahier des charges.
 */
export default function ImageUploadField({ context, onUploaded }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permet de resélectionner le même fichier ensuite
    if (!file) return;

    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('context', context);
      // Content-Type volontairement laissé à `undefined` (jamais
      // 'multipart/form-data' écrit à la main) : ce type MIME a besoin
      // d'un paramètre `boundary` que seul le navigateur peut calculer à
      // partir du FormData réel — l'écrire en dur casserait le découpage
      // des parties côté serveur. `apiClient` fixe 'application/json' par
      // défaut sur toutes les requêtes ; on l'exclut explicitement ici.
      const { data } = await apiClient.post('/uploads/image', formData, {
        headers: { 'Content-Type': undefined },
      });
      onUploaded(data.url);
    } catch (err) {
      setError(err.response?.data?.error?.message || "Échec de l'envoi de l'image.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={handleFileSelected}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-500 hover:text-brand-600 disabled:opacity-50"
      >
        <Upload size={14} />
        {uploading ? 'Envoi en cours...' : 'Envoyer une image'}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
