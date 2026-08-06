import { useState } from 'react';
import apiClient from '@/services/apiClient';

/**
 * Gestion des utilisateurs (Super Admin) — recherche, promotion/révocation
 * du statut Super Admin, et transfert de propriété de boutique.
 *
 * Le backend bloque la promotion tant que la personne possède une
 * boutique (§17_transfert_et_promotion.sql). Ce flux propose alors le
 * transfert directement, sans que l'utilisateur ait à deviner quoi faire.
 * La révocation, elle, redonne un compte utilisateur ordinaire sans
 * boutique (rien à restituer : elle a déjà été transférée avant promotion).
 */
export default function AdminUsersPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [busyUserId, setBusyUserId] = useState(null);
  const [transferTarget, setTransferTarget] = useState(null); // { userId, storeId, storeName, fullName }
  const [recipientQuery, setRecipientQuery] = useState('');
  const [recipientResults, setRecipientResults] = useState([]);
  const [searchingRecipient, setSearchingRecipient] = useState(false);

  // --- Assistance compte (§2 du cahier des charges "Système d'envoi
  // d'e-mails transactionnels", décidé en conversation) — garde-fou contre
  // le blocage permanent d'un compte PENDING_VERIFICATION dont l'e-mail
  // saisi à l'inscription était faux ou inaccessible.
  const [emailChangeTarget, setEmailChangeTarget] = useState(null); // { userId, fullName, currentEmail }
  const [newEmailInput, setNewEmailInput] = useState('');

  async function handleSearch(e) {
    e.preventDefault();
    setError('');
    setSearching(true);
    try {
      const { data } = await apiClient.get('/admin/users/search', { params: { q: query } });
      setResults(data.users);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Recherche impossible.');
    } finally {
      setSearching(false);
    }
  }

  async function refreshResults() {
    if (!query.trim()) return;
    const { data } = await apiClient.get('/admin/users/search', { params: { q: query } });
    setResults(data.users);
  }

  async function handlePromote(user) {
    setError('');
    setBusyUserId(user.id);
    try {
      await apiClient.post(`/admin/users/${user.id}/promote`);
      setSuccessMessage(`${user.fullName} est maintenant Super Admin.`);
      setTimeout(() => setSuccessMessage(''), 5000);
      await refreshResults();
    } catch (err) {
      if (err.response?.data?.error?.code === 'OWNS_STORE') {
        // Blocage attendu : proposer le transfert plutôt que de juste
        // afficher une erreur sans issue.
        setTransferTarget({
          userId: user.id,
          fullName: user.fullName,
          storeId: user.ownedStoreId,
          storeName: user.ownedStoreName,
        });
        setRecipientQuery('');
        setRecipientResults([]);
      } else {
        setError(err.response?.data?.error?.message || 'Promotion impossible.');
      }
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleRevoke(user) {
    if (!window.confirm(`Retirer le statut Super Admin de ${user.fullName} ?`)) return;
    setError('');
    setBusyUserId(user.id);
    try {
      await apiClient.post(`/admin/users/${user.id}/revoke`);
      setSuccessMessage(`${user.fullName} n'est plus Super Admin.`);
      setTimeout(() => setSuccessMessage(''), 5000);
      await refreshResults();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Révocation impossible.');
    } finally {
      setBusyUserId(null);
    }
  }

  function openEmailChange(user) {
    setEmailChangeTarget({ userId: user.id, fullName: user.fullName, currentEmail: user.email });
    setNewEmailInput(user.email);
    setError('');
  }

  async function handleUpdateEmail(e) {
    e.preventDefault();
    setError('');
    setBusyUserId(emailChangeTarget.userId);
    try {
      await apiClient.put(`/admin/users/${emailChangeTarget.userId}/email`, { newEmail: newEmailInput });
      setSuccessMessage(`E-mail de ${emailChangeTarget.fullName} mis à jour.`);
      setTimeout(() => setSuccessMessage(''), 5000);
      setEmailChangeTarget(null);
      await refreshResults();
    } catch (err) {
      setError(err.response?.data?.error?.message || "Impossible de changer l'e-mail.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleRelaunchVerification(user) {
    if (!window.confirm(`Renvoyer un code de vérification à ${user.fullName} (${user.email}) ?`)) return;
    setError('');
    setBusyUserId(user.id);
    try {
      await apiClient.post(`/admin/users/${user.id}/relaunch-verification`);
      setSuccessMessage(`Nouveau code de vérification envoyé à ${user.email}.`);
      setTimeout(() => setSuccessMessage(''), 5000);
      await refreshResults();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Renvoi impossible.');
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleSearchRecipient(e) {
    e.preventDefault();
    setSearchingRecipient(true);
    try {
      const { data } = await apiClient.get('/admin/users/search', { params: { q: recipientQuery } });
      // On ne propose jamais la personne elle-même ou un Super Admin
      // existant comme destinataire.
      setRecipientResults(
        data.users.filter((u) => u.id !== transferTarget.userId && !u.isSuperAdmin)
      );
    } finally {
      setSearchingRecipient(false);
    }
  }

  async function handleTransferAndPromote(recipient) {
    setError('');
    setBusyUserId(transferTarget.userId);
    try {
      await apiClient.post(`/admin/stores/${transferTarget.storeId}/transfer`, {
        newOwnerUserId: recipient.id,
      });
      // Le transfert a réussi : la personne d'origine ne possède plus
      // rien, on peut retenter la promotion immédiatement.
      await apiClient.post(`/admin/users/${transferTarget.userId}/promote`);
      setSuccessMessage(
        `Boutique "${transferTarget.storeName}" transférée à ${recipient.fullName}, puis ${transferTarget.fullName} promu Super Admin.`
      );
      setTimeout(() => setSuccessMessage(''), 6000);
      setTransferTarget(null);
      await refreshResults();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Transfert impossible.');
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-1">Utilisateurs</h1>
      <p className="text-sm text-slate-500 mb-6">
        Recherchez un compte, promouvez-le Super Admin, ou transférez une boutique.
      </p>

      {successMessage && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2 mb-4">
          {successMessage}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <form onSubmit={handleSearch} className="flex gap-2 mb-6 max-w-md">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher par nom ou e-mail..."
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          type="submit"
          disabled={searching}
          className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition disabled:opacity-60"
        >
          {searching ? 'Recherche...' : 'Chercher'}
        </button>
      </form>

      {results.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {/* Vue mobile : cartes empilées (< md) */}
          <div className="md:hidden divide-y divide-slate-100">
            {results.map((user) => (
              <div key={user.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">{user.fullName}</p>
                    <p className="text-xs text-slate-400 truncate">{user.email}</p>
                    {user.ownedStoreName && (
                      <p className="text-xs text-slate-400">Possède : {user.ownedStoreName}</p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      user.status === 'ACTIVE'
                        ? 'bg-green-50 text-green-700'
                        : user.status === 'PENDING_VERIFICATION'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {user.status === 'ACTIVE'
                      ? 'Actif'
                      : user.status === 'PENDING_VERIFICATION'
                        ? 'Non vérifié'
                        : 'Inactif'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs font-medium">
                  <button
                    onClick={() => openEmailChange(user)}
                    disabled={busyUserId === user.id}
                    className="text-slate-500 disabled:opacity-50"
                  >
                    Changer l'e-mail
                  </button>
                  {user.status !== 'ACTIVE' && (
                    <button
                      onClick={() => handleRelaunchVerification(user)}
                      disabled={busyUserId === user.id}
                      className="text-brand-500 disabled:opacity-50"
                    >
                      Relancer la vérification
                    </button>
                  )}
                  {user.isSuperAdmin ? (
                    <button
                      onClick={() => handleRevoke(user)}
                      disabled={busyUserId === user.id}
                      className="text-red-500 disabled:opacity-50"
                    >
                      {busyUserId === user.id ? 'Patientez...' : 'Retirer Super Admin'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePromote(user)}
                      disabled={busyUserId === user.id}
                      className="text-brand-500 disabled:opacity-50"
                    >
                      {busyUserId === user.id ? 'Patientez...' : 'Promouvoir Super Admin'}
                    </button>
                  )}
                </div>
                {user.isSuperAdmin && (
                  <span className="inline-block mt-2 rounded-full bg-amber-50 text-amber-700 px-2.5 py-0.5 text-xs font-medium">
                    Super Admin
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Vue desktop : tableau complet (dès md) */}
          <table className="hidden md:table w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Nom</th>
                <th className="text-left px-4 py-3">E-mail</th>
                <th className="text-left px-4 py-3">Statut</th>
                <th className="text-left px-4 py-3">Boutique possédée</th>
                <th className="text-right px-4 py-3">Assistance compte</th>
                <th className="text-right px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {results.map((user) => (
                <tr key={user.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">{user.fullName}</td>
                  <td className="px-4 py-3 text-slate-500">{user.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        user.status === 'ACTIVE'
                          ? 'bg-green-50 text-green-700'
                          : user.status === 'PENDING_VERIFICATION'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {user.status === 'ACTIVE'
                        ? 'Actif'
                        : user.status === 'PENDING_VERIFICATION'
                          ? 'Non vérifié'
                          : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{user.ownedStoreName || '—'}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => openEmailChange(user)}
                      disabled={busyUserId === user.id}
                      className="text-xs font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50 mr-3"
                    >
                      Changer l'e-mail
                    </button>
                    {user.status !== 'ACTIVE' && (
                      <button
                        onClick={() => handleRelaunchVerification(user)}
                        disabled={busyUserId === user.id}
                        className="text-xs font-medium text-brand-500 hover:text-brand-600 disabled:opacity-50"
                      >
                        Relancer la vérification
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {user.isSuperAdmin ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="inline-block rounded-full bg-amber-50 text-amber-700 px-2.5 py-0.5 text-xs font-medium">
                          Super Admin
                        </span>
                        <button
                          onClick={() => handleRevoke(user)}
                          disabled={busyUserId === user.id}
                          className="text-xs font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
                        >
                          {busyUserId === user.id ? 'Patientez...' : 'Retirer'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handlePromote(user)}
                        disabled={busyUserId === user.id}
                        className="text-xs font-medium text-brand-500 hover:text-brand-600 disabled:opacity-50"
                      >
                        {busyUserId === user.id ? 'Patientez...' : 'Promouvoir Super Admin'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* --- Assistance compte : changer l'e-mail d'un utilisateur --- */}
      {emailChangeTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">Changer l'e-mail de {emailChangeTarget.fullName}</h2>
              <p className="text-xs text-slate-500 mt-1">
                À utiliser si la personne s'est trompée d'adresse à l'inscription et reste bloquée sur un
                compte non vérifié — pensez à "Relancer la vérification" juste après.
              </p>
            </div>
            <form onSubmit={handleUpdateEmail} className="px-6 py-5">
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-3">
                  {error}
                </p>
              )}
              <label className="block text-sm font-medium text-slate-600 mb-1">Nouvel e-mail</label>
              <input
                type="email"
                required
                autoFocus
                value={newEmailInput}
                onChange={(e) => setNewEmailInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={busyUserId === emailChangeTarget.userId}
                  className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition disabled:opacity-60"
                >
                  {busyUserId === emailChangeTarget.userId ? 'Enregistrement...' : 'Enregistrer'}
                </button>
                <button
                  type="button"
                  onClick={() => setEmailChangeTarget(null)}
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Flux de transfert, déclenché quand la promotion est bloquée --- */}
      {transferTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">Transférer la boutique d'abord</h2>
              <p className="text-xs text-slate-500 mt-1">
                <span className="font-medium">{transferTarget.fullName}</span> possède{' '}
                <span className="font-medium">"{transferTarget.storeName}"</span> — il faut la
                transférer à quelqu'un d'autre avant de pouvoir le promouvoir Super Admin.
              </p>
            </div>

            <div className="px-6 py-5">
              <form onSubmit={handleSearchRecipient} className="flex gap-2 mb-4">
                <input
                  autoFocus
                  value={recipientQuery}
                  onChange={(e) => setRecipientQuery(e.target.value)}
                  placeholder="Nouveau propriétaire (nom ou e-mail)..."
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="submit"
                  disabled={searchingRecipient}
                  className="rounded-lg bg-slate-100 text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-200 transition disabled:opacity-60"
                >
                  Chercher
                </button>
              </form>

              {recipientResults.length > 0 && (
                <div className="rounded-lg border border-slate-200 overflow-hidden mb-4">
                  {recipientResults.map((candidate) => (
                    <button
                      key={candidate.id}
                      onClick={() => handleTransferAndPromote(candidate)}
                      disabled={busyUserId === transferTarget.userId}
                      className="w-full text-left px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <p className="text-sm font-medium text-slate-800">{candidate.fullName}</p>
                      <p className="text-xs text-slate-400">
                        {candidate.email}
                        {candidate.ownedStoreName && ` · possède déjà "${candidate.ownedStoreName}"`}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {recipientQuery.trim() && recipientResults.length === 0 && !searchingRecipient && (
                <p className="text-sm text-slate-400 mb-4">Aucun candidat trouvé.</p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setTransferTarget(null)}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}