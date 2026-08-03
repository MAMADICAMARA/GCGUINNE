import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';

/**
 * Deuxième étape de la validation d'une vente (§4.6 / §4.7 du cahier des
 * charges) : rattacher un client, en préparer un nouveau, ou vendre sans
 * client. Volontairement réduit à deux champs (nom, téléphone) — beaucoup
 * de clients ne savent pas lire/écrire, un formulaire long serait un frein
 * réel en caisse.
 *
 * Important : un NOUVEAU client n'est jamais créé ici. On transmet
 * seulement { id: null, name, phone, isNewCustomer: true } à l'étape
 * suivante — c'est seulement au moment où la vente est réellement
 * confirmée (OrderSummaryModal) que le client est créé, DANS LA MÊME
 * transaction que la commande (voir orders.service.js). Sans ça, un client
 * saisi ici puis abandonné (retour en arrière, vente annulée) resterait
 * enregistré en base sans avoir jamais rien acheté.
 */
export default function CustomerStepModal({ onConfirm, onBack }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  // Recherche avec un léger délai, comme sur la page Stock.
  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const { data } = await apiClient.get('/customers/search', { params: { q: search } });
        setResults(data.customers);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  function handlePrepareNewCustomer(e) {
    e.preventDefault();
    // Simple transmission en mémoire — aucun appel API ici.
    onConfirm({
      id: null,
      name: newName.trim(),
      phone: newPhone.trim() || null,
      isNewCustomer: true,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Client</h2>
          <p className="text-xs text-slate-400">
            Recherchez un client existant, ajoutez-en un nouveau, ou vendez
            sans client.
          </p>
        </div>

        <div className="px-6 py-5">
          {!showCreateForm ? (
            <>
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nom ou numéro de téléphone..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />

              {searching && <p className="text-sm text-slate-400 mb-3">Recherche...</p>}

              {results.length > 0 && (
                <div className="rounded-lg border border-slate-200 overflow-hidden mb-3">
                  {results.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => onConfirm({ id: customer.id, name: customer.name })}
                      className="w-full text-left px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                    >
                      <p className="text-sm font-medium text-slate-800">{customer.name}</p>
                      <p className="text-xs text-slate-400">{customer.phone || 'Sans téléphone'}</p>
                    </button>
                  ))}
                </div>
              )}

              {search.trim() && !searching && results.length === 0 && (
                <p className="text-sm text-slate-400 mb-3">Aucun client trouvé.</p>
              )}

              <button
                onClick={() => {
                  setNewName(search.trim());
                  setShowCreateForm(true);
                }}
                className="w-full rounded-lg border border-dashed border-slate-300 text-slate-600 text-sm font-medium py-2.5 hover:bg-slate-50 transition mb-3"
              >
                + Nouveau client
              </button>

              <button
                onClick={() => onConfirm({ id: null, name: 'Client anonyme' })}
                className="w-full rounded-lg bg-brand-500 text-white text-sm font-medium py-2.5 hover:bg-brand-600 transition"
              >
                Vente sans client
              </button>
            </>
          ) : (
            <form onSubmit={handlePrepareNewCustomer} className="space-y-3">
              <p className="text-xs text-slate-400 -mt-1 mb-1">
                Ce client sera enregistré uniquement si la vente est confirmée
                à l'étape suivante.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Nom</label>
                <input
                  autoFocus
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Mamadou Diallo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Téléphone (optionnel)
                </label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="622 00 00 00"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-brand-500 text-white text-sm font-medium py-2.5 hover:bg-brand-600 transition"
                >
                  Continuer
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  Retour
                </button>
              </div>
            </form>
          )}
        </div>

        {!showCreateForm && (
          <div className="px-6 py-4 border-t border-slate-100">
            <button
              onClick={onBack}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              ← Retour au panier
            </button>
          </div>
        )}
      </div>
    </div>
  );
}