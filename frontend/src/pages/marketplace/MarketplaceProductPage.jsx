import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Package, Phone, Share2, Store, User } from 'lucide-react';
import apiClient from '@/services/apiClient';
import { formatGNF } from '@/utils/format';
import { getProductShareUrl } from '@/utils/shareUrl';
import ShareMenu from './ShareMenu';

const WhatsAppIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    <path d="M12.001 2C6.478 2 2 6.477 2 12c0 1.892.526 3.66 1.437 5.168L2 22l4.958-1.395A9.945 9.945 0 0 0 12 22c5.523 0 10-4.477 10-10S17.524 2 12 2zm0 18.09a8.06 8.06 0 0 1-4.267-1.222l-.306-.183-3.032.853.86-2.955-.2-.312A8.078 8.078 0 1 1 12 20.09z" />
  </svg>
);

function normalizeGuineaPhone(rawPhone) {
  const digits = (rawPhone || '').replace(/\D/g, '');
  if (!digits) return null;
  return digits.startsWith('224') ? digits : `224${digits}`;
}

/**
 * Page produit MARCHÉ (§7, décidé en conversation) — design "ultra
 * moderne" façon vitrine e-commerce mobile : image en pleine largeur,
 * boutons flottants en verre dépoli par-dessus, carte de contenu qui
 * remonte sur l'image, actions de contact rapides (Appeler/WhatsApp)
 * directement sous le vendeur. Remplace l'ancienne modale — une vraie
 * URL, publique (jamais de redirection /login), pensée pour être
 * partagée sur les réseaux sociaux via ShareMenu (bouton "Partager" qui
 * ne dépend d'aucune API navigateur pour fonctionner).
 */
export default function MarketplaceProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');
    setProduct(null);
    apiClient
      .get(`/marketplace/products/${id}`)
      .then(({ data }) => setProduct(data))
      .catch((err) => setError(err.response?.data?.error?.message || 'Impossible de charger ce produit.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-brand-500 animate-spin" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 text-center">
        <Package className="h-12 w-12 text-slate-300 mb-3" strokeWidth={1.5} />
        <p className="text-slate-600 font-medium mb-4">{error || 'Produit introuvable.'}</p>
        <button
          onClick={() => navigate('/marche')}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 text-white text-sm font-medium px-5 py-2.5 hover:bg-brand-600 transition"
        >
          <ArrowLeft size={16} />
          Retour au marché
        </button>
      </div>
    );
  }

  const whatsappNumber = normalizeGuineaPhone(product.store.phone);
  const shareUrl = getProductShareUrl(id);

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {/* --- Image + boutons flottants en verre dépoli --- */}
      <div className="relative h-[42vh] sm:h-[48vh] bg-slate-200">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300">
            <Package className="h-16 w-16 text-slate-400" strokeWidth={1.25} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-transparent to-black/10" />

        <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <button
            onClick={() => navigate('/marche')}
            className="h-10 w-10 flex items-center justify-center rounded-full bg-white/25 backdrop-blur-md text-white shadow-sm hover:bg-white/40 transition"
            aria-label="Retour au marché"
          >
            <ArrowLeft size={18} strokeWidth={2.25} />
          </button>
          <button
            onClick={() => setShareOpen(true)}
            className="h-10 w-10 flex items-center justify-center rounded-full bg-white/25 backdrop-blur-md text-white shadow-sm hover:bg-white/40 transition"
            aria-label="Partager"
          >
            <Share2 size={17} strokeWidth={2.25} />
          </button>
        </div>
      </div>

      {/* --- Carte de contenu, remonte sur l'image --- */}
      <div className="relative -mt-8 rounded-t-[2rem] bg-slate-50 px-4 sm:px-6 pt-6">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 shadow-sm text-slate-500 text-xs font-medium px-3 py-1.5 mb-3">
            <Store size={12} strokeWidth={2} />
            {product.store.name}
          </div>

          <h1 className="text-2xl font-bold text-slate-800 leading-snug">{product.name}</h1>
          <p className="text-3xl font-extrabold bg-gradient-to-r from-brand-600 to-brand-500 bg-clip-text text-transparent mt-2">
            {formatGNF(product.sellingPrice)}
          </p>

          {product.priceTiers.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Prix par quantité</p>
              <div className="flex flex-wrap gap-2">
                {product.priceTiers.map((tier, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 shadow-sm px-3.5 py-2 text-xs"
                  >
                    <span className="text-slate-500">≥{tier.minQuantity}u</span>
                    <span className="font-semibold text-slate-800">{formatGNF(tier.unitPrice)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {Object.keys(product.attributes || {}).length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Caractéristiques</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(product.attributes).map(([key, value]) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 shadow-sm px-3.5 py-2 text-xs"
                  >
                    <span className="text-slate-500">{key} :</span>
                    <span className="font-semibold text-slate-800">{value}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {product.description && (
            <div className="mt-6">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Description</p>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{product.description}</p>
            </div>
          )}

          <div className="mt-7 rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Vendu par</p>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-white flex items-center justify-center font-bold text-base">
                {product.store.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{product.store.name}</p>
                {product.store.ownerName && (
                  <p className="text-xs text-slate-400 flex items-center gap-1 truncate">
                    <User size={11} className="shrink-0" />
                    {product.store.ownerName}
                  </p>
                )}
              </div>
            </div>

            {(product.store.address || product.store.phone) && (
              <div className="mt-3.5 space-y-1.5">
                {product.store.address && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <MapPin size={14} className="text-slate-400 shrink-0" strokeWidth={1.75} />
                    {product.store.address}
                  </div>
                )}
                {product.store.phone && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone size={14} className="text-slate-400 shrink-0" strokeWidth={1.75} />
                    {product.store.phone}
                  </div>
                )}
              </div>
            )}

            {whatsappNumber && (
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <a
                  href={`tel:+${whatsappNumber}`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold py-2.5 hover:bg-slate-200 transition"
                >
                  <Phone size={15} strokeWidth={2} />
                  Appeler
                </a>
                <a
                  href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Bonjour, je suis intéressé(e) par "${product.name}" vu sur le Marché.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] text-white text-sm font-semibold py-2.5 hover:brightness-95 transition"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  WhatsApp
                </a>
              </div>
            )}
          </div>

          {product.relatedProducts.length > 0 && (
            <div className="mt-8">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Vous pourriez aussi aimer
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {product.relatedProducts.map((related) => (
                  <button
                    key={related.id}
                    onClick={() => navigate(`/marche/produits/${related.id}`)}
                    className="group text-left rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="aspect-square bg-slate-100">
                      {related.imageUrl ? (
                        <img src={related.imageUrl} alt={related.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-8 w-8 text-slate-300" strokeWidth={1.5} />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-medium text-slate-800 truncate group-hover:text-brand-600 transition-colors">
                        {related.name}
                      </p>
                      <p className="text-sm font-semibold text-brand-600 mt-0.5">{formatGNF(related.sellingPrice)}</p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{related.storeName}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {shareOpen && (
        <ShareMenu url={shareUrl} title={product.name} onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
}
