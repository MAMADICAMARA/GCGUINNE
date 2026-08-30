import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Search, Sparkles, X } from 'lucide-react';
import apiClient from '@/services/apiClient';
import { formatGNF } from '@/utils/format';

/**
 * Grille de produits MARCHÉ (§ cahier des charges §7/§9) — composant
 * PARTAGÉ entre la page publique (visiteur non connecté) et
 * AccountHomePage (utilisateur connecté, cf. §5) : même contenu, même
 * comportement au clic, seul le cadre autour change. Grande image, peu de
 * texte, gros repères visuels — pensé pour un public peu habitué à la
 * technologie, qui parcourt par les yeux plutôt que par la lecture.
 *
 * Clic -> navigue vers la vraie page produit (§ partage sur les réseaux
 * sociaux, décidé en conversation), jamais une modale ni une redirection
 * /login : MARCHÉ est une vitrine publique, accessible sans connexion.
 *
 * Recherche (§ barre de recherche par nom/référence, décidé en
 * conversation, partagée entre /marche et l'Accueil connecté puisque
 * toutes deux rendent ce même composant) : debounce de 300ms pour éviter
 * un appel API à chaque frappe. Le premier chargement (sans recherche)
 * garde le même état "Chargement du catalogue..." qu'avant cet ajout ;
 * une recherche en cours affiche un indicateur plus discret pour ne pas
 * faire disparaître/réapparaître toute la grille à chaque lettre tapée.
 */
export default function MarketplaceGrid() {
  const navigate = useNavigate();
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);

  // Debounce : n'envoie la recherche que 300ms après la dernière frappe.
  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    if (products !== null) setSearching(true);
    (async () => {
      try {
        const { data } = await apiClient.get('/marketplace/products', {
          params: search ? { search } : undefined,
        });
        if (!cancelled) {
          setProducts(data.products);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error?.message || 'Impossible de charger le catalogue.');
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const searchBar = (
    <div className="relative mb-5">
      <Search
        className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
        strokeWidth={2}
      />
      <input
        type="text"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Rechercher par nom ou référence..."
        className="w-full rounded-full border border-slate-200 bg-white pl-10 pr-10 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition"
      />
      {searchInput && (
        <button
          onClick={() => setSearchInput('')}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 hover:text-slate-600 transition"
          aria-label="Effacer la recherche"
        >
          <X size={16} strokeWidth={2.25} />
        </button>
      )}
    </div>
  );

  if (error) {
    return (
      <div>
        {searchBar}
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</p>
      </div>
    );
  }

  if (products === null) {
    return (
      <div>
        {searchBar}
        <p className="text-sm text-slate-400 text-center py-12">Chargement du catalogue...</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div>
        {searchBar}
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 px-6 text-center">
          <Sparkles className="h-10 w-10 text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-slate-600 font-medium">
            {search ? 'Aucun produit ne correspond à votre recherche.' : "Aucun produit pour l'instant."}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {search
              ? 'Essayez un autre nom ou une autre référence.'
              : 'Revenez bientôt — de nouvelles boutiques arrivent régulièrement.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {searchBar}
      <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5 transition-opacity ${searching ? 'opacity-60' : 'opacity-100'}`}>
        {products.map((product) => (
          <button
            key={product.id}
            onClick={() => navigate(`/marche/produits/${product.id}`)}
            className="group text-left rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="relative aspect-square bg-slate-100">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-10 w-10 text-slate-300" strokeWidth={1.5} />
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="text-sm font-medium text-slate-800 truncate group-hover:text-brand-600 transition-colors">
                {product.name}
              </p>
              <p className="text-base font-semibold text-brand-600 mt-0.5">{formatGNF(product.sellingPrice)}</p>
              <p className="text-xs text-slate-400 truncate mt-0.5">{product.storeName}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// import { useEffect, useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { Package, Sparkles } from 'lucide-react';
// import apiClient from '@/services/apiClient';
// import { formatGNF } from '@/utils/format';

// /**
//  * Grille de produits MARCHÉ (§ cahier des charges §7/§9) — composant
//  * PARTAGÉ entre la page publique (visiteur non connecté) et
//  * AccountHomePage (utilisateur connecté, cf. §5) : même contenu, même
//  * comportement au clic, seul le cadre autour change. Grande image, peu de
//  * texte, gros repères visuels — pensé pour un public peu habitué à la
//  * technologie, qui parcourt par les yeux plutôt que par la lecture.
//  *
//  * Clic -> navigue vers la vraie page produit (§ partage sur les réseaux
//  * sociaux, décidé en conversation), jamais une modale ni une redirection
//  * /login : MARCHÉ est une vitrine publique, accessible sans connexion.
//  */
// export default function MarketplaceGrid() {
//   const navigate = useNavigate();
//   const [products, setProducts] = useState(null);
//   const [error, setError] = useState('');

//   useEffect(() => {
//     (async () => {
//       try {
//         const { data } = await apiClient.get('/marketplace/products');
//         setProducts(data.products);
//       } catch (err) {
//         setError(err.response?.data?.error?.message || 'Impossible de charger le catalogue.');
//       }
//     })();
//   }, []);

//   if (error) {
//     return <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</p>;
//   }

//   if (!products) {
//     return <p className="text-sm text-slate-400 text-center py-12">Chargement du catalogue...</p>;
//   }

//   if (products.length === 0) {
//     return (
//       <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 px-6 text-center">
//         <Sparkles className="h-10 w-10 text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
//         <p className="text-slate-600 font-medium">Aucun produit pour l'instant.</p>
//         <p className="text-sm text-slate-400 mt-1">Revenez bientôt — de nouvelles boutiques arrivent régulièrement.</p>
//       </div>
//     );
//   }

//   return (
//     <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
//       {products.map((product) => (
//         <button
//           key={product.id}
//           onClick={() => navigate(`/marche/produits/${product.id}`)}
//           className="group text-left rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow"
//         >
//           <div className="relative aspect-square bg-slate-100">
//             {product.imageUrl ? (
//               <img
//                 src={product.imageUrl}
//                 alt={product.name}
//                 className="w-full h-full object-cover"
//               />
//             ) : (
//               <div className="w-full h-full flex items-center justify-center">
//                 <Package className="h-10 w-10 text-slate-300" strokeWidth={1.5} />
//               </div>
//             )}
//           </div>
//           <div className="p-3">
//             <p className="text-sm font-medium text-slate-800 truncate group-hover:text-brand-600 transition-colors">
//               {product.name}
//             </p>
//             <p className="text-base font-semibold text-brand-600 mt-0.5">{formatGNF(product.sellingPrice)}</p>
//             <p className="text-xs text-slate-400 truncate mt-0.5">{product.storeName}</p>
//           </div>
//         </button>
//       ))}
//     </div>
//   );
// }
