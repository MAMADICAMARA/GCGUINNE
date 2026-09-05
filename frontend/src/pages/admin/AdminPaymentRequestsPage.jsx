import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Layers, Wallet } from 'lucide-react';
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
 * Regroupe les demandes partageant un batchId (§52_lot_paiement_abonnement.sql,
 * "Payer pour toutes", décidé en conversation) — plusieurs boutiques payées
 * en une fois par un même superviseur. `requests` arrive déjà trié du plus
 * récent au plus ancien (ORDER BY created_at DESC côté serveur) ; on
 * préserve cet ordre global en triant les items de lot par la date de leur
 * membre le plus récent.
 */
function buildDisplayItems(requests) {
  const batches = new Map();
  const singles = [];
  for (const r of requests) {
    if (r.batchId) {
      if (!batches.has(r.batchId)) batches.set(r.batchId, []);
      batches.get(r.batchId).push(r);
    } else {
      singles.push({ type: 'single', request: r, sortKey: r.createdAt });
    }
  }
  const batchItems = [...batches.entries()].map(([batchId, members]) => ({
    type: 'batch',
    batchId,
    members,
    sortKey: members[0].createdAt,
  }));
  return [...singles, ...batchItems].sort((a, b) => new Date(b.sortKey) - new Date(a.sortKey));
}

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
  const [expandedBatches, setExpandedBatches] = useState(() => new Set());

  function toggleBatch(batchId) {
    setExpandedBatches((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  }

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
    const months = request.months || 1;
    if (
      !window.confirm(
        `Confirmer le paiement de ${request.storeName} (${request.planName}, ${request.amountDeclared.toLocaleString('fr-FR')} GNF) ? Le plan sera activé immédiatement pour ${months} mois (${months * 30} jours).`
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
      <div className="flex items-center gap-2.5 mb-1">
        <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <Wallet size={18} />
        </div>
        <h1 className="text-xl font-semibold text-slate-800">Demandes de paiement</h1>
      </div>
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
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {/* Vue mobile : cartes empilées (< md) */}
          <div className="md:hidden divide-y divide-slate-100">
            {buildDisplayItems(requests).map((item) =>
              item.type === 'single' ? (
                <RequestCard
                  key={item.request.id}
                  r={item.request}
                  status={status}
                  busyId={busyId}
                  onConfirm={handleConfirm}
                  onReject={setRejectingRequest}
                />
              ) : (
                <BatchGroup
                  key={item.batchId}
                  batchId={item.batchId}
                  members={item.members}
                  expanded={expandedBatches.has(item.batchId)}
                  onToggle={() => toggleBatch(item.batchId)}
                  view="mobile"
                  status={status}
                  busyId={busyId}
                  onConfirm={handleConfirm}
                  onReject={setRejectingRequest}
                />
              )
            )}
          </div>

          {/* Vue desktop : tableau complet (dès md) */}
          <table className="hidden md:table w-full text-sm">
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
              {buildDisplayItems(requests).map((item) =>
                item.type === 'single' ? (
                  <RequestRow
                    key={item.request.id}
                    r={item.request}
                    status={status}
                    busyId={busyId}
                    onConfirm={handleConfirm}
                    onReject={setRejectingRequest}
                  />
                ) : (
                  <BatchGroup
                    key={item.batchId}
                    batchId={item.batchId}
                    members={item.members}
                    expanded={expandedBatches.has(item.batchId)}
                    onToggle={() => toggleBatch(item.batchId)}
                    view="desktop"
                    status={status}
                    busyId={busyId}
                    onConfirm={handleConfirm}
                    onReject={setRejectingRequest}
                  />
                )
              )}
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

function StatusPill({ s }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        s === 'CONFIRMED' ? 'bg-green-50 text-green-700' : s === 'REJECTED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
      }`}
    >
      {STATUS_LABELS[s]}
    </span>
  );
}

function RequestCard({ r, status, busyId, onConfirm, onReject, indent = false }) {
  return (
    <div className={`p-4 ${indent ? 'pl-8 bg-slate-50/60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-slate-800 truncate">{r.storeName}</p>
          <p className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
            {r.planName} · {PAYMENT_METHOD_LABELS[r.paymentMethod]}
            <span className="inline-block rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 font-medium">
              {r.months || 1} mois
            </span>
          </p>
        </div>
        <StatusPill s={r.status} />
      </div>
      <p className="text-sm font-medium text-slate-800 mt-2">{Number(r.amountDeclared).toLocaleString('fr-FR')} GNF</p>
      {!indent && <p className="text-xs text-slate-400 font-mono">{r.transactionReference}</p>}
      <p className="text-xs text-slate-400 mt-1">
        {r.requestedByName}
        {r.requestedBySupervisor && (
          <span className="ml-1 inline-block rounded-full bg-violet-50 text-violet-600 px-1.5 py-0.5 text-[10px] font-medium align-middle">
            superviseur
          </span>
        )}{' '}
        · {formatDateTime(r.createdAt)}
      </p>
      {r.status === 'REJECTED' && r.rejectionReason && <p className="text-xs text-slate-400 mt-1">{r.rejectionReason}</p>}
      {status === 'PENDING' && r.status === 'PENDING' && (
        <div className="flex gap-4 mt-3 text-xs font-medium">
          <button onClick={() => onConfirm(r)} disabled={busyId === r.id} className="text-green-600 disabled:opacity-50">
            Confirmer
          </button>
          <button onClick={() => onReject(r)} disabled={busyId === r.id} className="text-red-500 disabled:opacity-50">
            Rejeter
          </button>
        </div>
      )}
    </div>
  );
}

function RequestRow({ r, status, busyId, onConfirm, onReject, indent = false }) {
  return (
    <tr className={`border-t border-slate-100 ${indent ? 'bg-slate-50/60' : ''}`}>
      <td className={`px-4 py-3 font-medium text-slate-800 ${indent ? 'pl-8' : ''}`}>{r.storeName}</td>
      <td className="px-4 py-3 text-slate-600">
        {r.planName}{' '}
        <span className="inline-block rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-xs font-medium">
          {r.months || 1} mois
        </span>
      </td>
      <td className="px-4 py-3 text-slate-600">
        {PAYMENT_METHOD_LABELS[r.paymentMethod]}
        {r.payerPhone && <span className="block text-xs text-slate-400">{r.payerPhone}</span>}
      </td>
      <td className="px-4 py-3 text-slate-600 font-mono text-xs">{indent ? '—' : r.transactionReference}</td>
      <td className="px-4 py-3 text-right font-medium text-slate-800">
        {Number(r.amountDeclared).toLocaleString('fr-FR')} GNF
      </td>
      <td className="px-4 py-3 text-slate-500">
        {r.requestedByName}
        {r.requestedBySupervisor && (
          <span className="ml-1.5 inline-block rounded-full bg-violet-50 text-violet-600 px-1.5 py-0.5 text-[10px] font-medium align-middle">
            superviseur
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
      <td className="px-4 py-3">
        <StatusPill s={r.status} />
        {r.status === 'REJECTED' && r.rejectionReason && (
          <span className="block text-xs text-slate-400 mt-1">{r.rejectionReason}</span>
        )}
      </td>
      {status === 'PENDING' && (
        <td className="px-4 py-3 text-right whitespace-nowrap">
          {r.status === 'PENDING' && (
            <>
              <button
                onClick={() => onConfirm(r)}
                disabled={busyId === r.id}
                className="text-xs font-medium text-green-600 hover:text-green-700 disabled:opacity-50 mr-3"
              >
                Confirmer
              </button>
              <button
                onClick={() => onReject(r)}
                disabled={busyId === r.id}
                className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                Rejeter
              </button>
            </>
          )}
        </td>
      )}
    </tr>
  );
}

/**
 * Lot "Payer pour toutes" (§52_lot_paiement_abonnement.sql, décidé en
 * conversation) — carte/ligne d'en-tête repliable montrant le total et le
 * décompte par statut, qui déplie la liste des boutiques du lot ; chacune
 * garde son propre bouton Confirmer/Rejeter indépendant (même logique que
 * pour une demande normale, jamais un seul geste pour tout le lot).
 */
function BatchGroup({ members, expanded, onToggle, view, status, busyId, onConfirm, onReject }) {
  const total = members.reduce((sum, m) => sum + Number(m.amountDeclared), 0);
  const confirmedCount = members.filter((m) => m.status === 'CONFIRMED').length;
  const pendingCount = members.filter((m) => m.status === 'PENDING').length;
  const rejectedCount = members.filter((m) => m.status === 'REJECTED').length;
  const first = members[0];
  const ChevronIcon = expanded ? ChevronDown : ChevronRight;

  const summary = (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
        <Layers size={14} />
      </div>
      <div className="min-w-0">
        <p className="font-medium text-slate-800">
          Lot de {members.length} boutiques — {first.planName} · {first.months || 1} mois
        </p>
        <p className="text-xs text-slate-400 font-mono">{first.transactionReference}</p>
      </div>
    </div>
  );

  const counts = (
    <div className="flex items-center gap-1.5 flex-wrap">
      {pendingCount > 0 && <StatusPill s="PENDING" />}
      {confirmedCount > 0 && (
        <span className="inline-block rounded-full bg-green-50 text-green-700 px-2.5 py-0.5 text-xs font-medium">
          {confirmedCount} confirmée{confirmedCount > 1 ? 's' : ''}
        </span>
      )}
      {rejectedCount > 0 && (
        <span className="inline-block rounded-full bg-red-50 text-red-700 px-2.5 py-0.5 text-xs font-medium">
          {rejectedCount} refusée{rejectedCount > 1 ? 's' : ''}
        </span>
      )}
    </div>
  );

  if (view === 'mobile') {
    return (
      <div>
        <button onClick={onToggle} className="w-full text-left p-4 hover:bg-slate-50 transition">
          <div className="flex items-start justify-between gap-2">
            {summary}
            <ChevronIcon size={16} className="text-slate-400 shrink-0 mt-1" />
          </div>
          <p className="text-sm font-semibold text-slate-800 mt-2">
            Total : {total.toLocaleString('fr-FR')} GNF
          </p>
          <div className="mt-2">{counts}</div>
        </button>
        {expanded && (
          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {members.map((m) => (
              <RequestCard key={m.id} r={m} status={status} busyId={busyId} onConfirm={onConfirm} onReject={onReject} indent />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <tr className="border-t border-slate-100 bg-violet-50/30 cursor-pointer hover:bg-violet-50/60" onClick={onToggle}>
        <td className="px-4 py-3" colSpan={4}>
          <div className="flex items-center gap-2">
            <ChevronIcon size={14} className="text-slate-400 shrink-0" />
            {summary}
          </div>
        </td>
        <td className="px-4 py-3 text-right font-semibold text-slate-800">{total.toLocaleString('fr-FR')} GNF</td>
        <td className="px-4 py-3 text-slate-500" colSpan={2}>
          {counts}
        </td>
        <td className="px-4 py-3" colSpan={status === 'PENDING' ? 2 : 1} />
      </tr>
      {expanded &&
        members.map((m) => (
          <RequestRow key={m.id} r={m} status={status} busyId={busyId} onConfirm={onConfirm} onReject={onReject} indent />
        ))}
    </>
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
