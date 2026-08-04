import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import { formatDateTime } from '@/utils/format';

const PAYMENT_METHOD_LABELS = {
  ORANGE_MONEY: 'Orange Money',
  MOBILE_MONEY: 'Mobile Money',
  PAYCARD: 'PayCard',
};

const STATUS_LABELS = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  REJECTED: 'Refusée',
};

/**
 * Demandes de paiement d'abonnement déclarées par les Owners
 * (§27_paiement_abonnement.sql, décidé en conversation) — "Confirmer"
 * appelle EXACTEMENT la même activation que /admin/stores/:id (Gérer le
 * plan, StorePlanModal.jsx), jamais dupliquée. Cette dernière reste
 * disponible en parallèle depuis "Boutiques" pour toute activation
 * manuelle indépendante de ce flux déclaratif.
 */
export default function AdminPaymentRequestsPage() {
  const [status, setStatus] = useState('PENDING');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [rejectingRequest, setRejectingRequest] = useState(null);

  async function loadRequests() {
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get('/admin/payment-requests', { params: { status, limit: 50 } });
      setRequests(data.requests);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Impossible de charger les demandes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function handleConfirm(request) {
    if (
      !window.confirm(
        `Confirmer le paiement de ${request.storeName} (${request.planName}, ${request.amountDeclared.toLocaleString('fr-FR')} GNF) ? Le plan sera activé immédiatement pour 30 jours.`
      )
    ) {
      return;
    }
    setBusyId(request.id);
    setError('');
    try {
      await apiClient.post(`/admin/payment-requests/${request.id}/confirm`);
      setSuccessMessage(`Plan ${request.planName} activé pour ${request.storeName}.`);
      setTimeout(() => setSuccessMessage(''), 6000);
      await loadRequests();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Confirmation impossible.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-1">Demandes de paiement</h1>
      <p className="text-sm text-slate-500 mb-6">
        Paiements d'abonnement déclarés par les boutiques (Orange Money, Mobile Money, PayCard) — à vérifier
        avant confirmation.
      </p>

      <PaymentSettingsSection />

      <div className="flex items-center gap-2 mb-4">
        {['PENDING', 'CONFIRMED', 'REJECTED', 'ALL'].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              status === s ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {s === 'ALL' ? 'Toutes' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">{error}</p>
      )}
      {successMessage && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2 mb-4">
          {successMessage}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          Aucune demande {status !== 'ALL' ? STATUS_LABELS[status].toLowerCase() : ''}.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Boutique</th>
                <th className="text-left px-4 py-3">Plan</th>
                <th className="text-left px-4 py-3">Méthode</th>
                <th className="text-left px-4 py-3">Référence</th>
                <th className="text-right px-4 py-3">Montant</th>
                <th className="text-left px-4 py-3">Demandé par</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Statut</th>
                {status === 'PENDING' && <th className="text-right px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.storeName}</td>
                  <td className="px-4 py-3 text-slate-600">{r.planName}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {PAYMENT_METHOD_LABELS[r.paymentMethod]}
                    {r.payerPhone && <span className="block text-xs text-slate-400">{r.payerPhone}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">{r.transactionReference}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">
                    {Number(r.amountDeclared).toLocaleString('fr-FR')} GNF
                  </td>
                  <td className="px-4 py-3 text-slate-500">{r.requestedByName}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        r.status === 'CONFIRMED'
                          ? 'bg-green-50 text-green-700'
                          : r.status === 'REJECTED'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {STATUS_LABELS[r.status]}
                    </span>
                    {r.status === 'REJECTED' && r.rejectionReason && (
                      <span className="block text-xs text-slate-400 mt-1">{r.rejectionReason}</span>
                    )}
                  </td>
                  {status === 'PENDING' && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleConfirm(r)}
                        disabled={busyId === r.id}
                        className="text-xs font-medium text-green-600 hover:text-green-700 disabled:opacity-50 mr-3"
                      >
                        Confirmer
                      </button>
                      <button
                        onClick={() => setRejectingRequest(r)}
                        disabled={busyId === r.id}
                        className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        Rejeter
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rejectingRequest && (
        <RejectRequestModal
          request={rejectingRequest}
          onClose={() => setRejectingRequest(null)}
          onRejected={() => {
            setRejectingRequest(null);
            loadRequests();
          }}
        />
      )}
    </div>
  );
}

function RejectRequestModal({ request, onClose, onRejected }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await apiClient.post(`/admin/payment-requests/${request.id}/reject`, { reason: reason.trim() });
      onRejected();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Refus impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Rejeter la demande — {request.storeName}</h2>
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
          <label className="block text-sm font-medium text-slate-600 mb-1">Motif du refus</label>
          <textarea
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex : référence introuvable sur le relevé, montant incorrect..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-red-600 text-white text-sm font-medium px-4 py-2 hover:bg-red-700 transition disabled:opacity-60"
          >
            {submitting ? 'Envoi...' : 'Rejeter la demande'}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Configuration des moyens de paiement affichés côté Owner
 * (SubscriptionPaymentModal.jsx) — jamais de valeur par défaut inventée,
 * la ligne démarre vide en base tant que le Super Admin ne l'a pas remplie.
 */
function PaymentSettingsSection() {
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await apiClient.get('/admin/payment-settings');
        setForm(data);
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Impossible de charger les réglages.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const { data } = await apiClient.put('/admin/payment-settings', form);
      setForm(data);
      setSuccess('Réglages enregistrés.');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 mb-6">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full text-left"
      >
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Configurer les moyens de paiement</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Numéros/coordonnées affichés aux Owners lors d'une déclaration de paiement.
          </p>
        </div>
        <span className="text-slate-400 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          {loading ? (
            <p className="text-sm text-slate-400">Chargement...</p>
          ) : (
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
              {success && <p className="text-sm text-green-700 sm:col-span-2">{success}</p>}

              <Field label="Numéro Orange Money" value={form.orangeMoneyNumber} onChange={update('orangeMoneyNumber')} />
              <Field label="Numéro Mobile Money" value={form.mobileMoneyNumber} onChange={update('mobileMoneyNumber')} />
              <Field label="Infos PayCard" value={form.paycardInfo} onChange={update('paycardInfo')} />
              <Field label="Téléphone de contact" value={form.contactPhone} onChange={update('contactPhone')} />
              <Field label="WhatsApp de contact" value={form.contactWhatsapp} onChange={update('contactWhatsapp')} />
              <Field label="E-mail de contact" value={form.contactEmail} onChange={update('contactEmail')} type="email" />

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition disabled:opacity-60"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={onChange}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
    </div>
  );
}
