import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import { formatDateTime } from '@/utils/format';
import AddEmployeeModal from './AddEmployeeModal';

const ROLE_LABELS = { OWNER: 'Propriétaire', SELLER: 'Vendeur' };

/**
 * Page Équipe (§4.3 du cahier des charges) — réservée au Owner (déjà
 * vérifié côté backend par requireRole('OWNER') sur toutes les routes
 * /employees, et côté navigation par routes/navigation.js). Pas de rôle
 * Manager (abandonné, contexte guinéen : cf. 21_abandon_role_manager.sql)
 * — un employé est toujours Vendeur, aucun changement de rôle possible.
 */
export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [planStatus, setPlanStatus] = useState(null);

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const [employeesRes, invitationsRes, planRes] = await Promise.all([
        apiClient.get('/employees'),
        apiClient.get('/employees/invitations'),
        apiClient.get('/stores/plan-status'),
      ]);
      setEmployees(employeesRes.data.employees);
      setInvitations(invitationsRes.data.invitations);
      setPlanStatus(planRes.data);
    } catch (err) {
      setError(err.response?.data?.error?.message || "Impossible de charger l'équipe.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  // Le plan FREEMIUM (1 utilisateur = l'Owner seul) n'autorise aucun
  // employé (§20_plans_abonnement.sql, décidé en conversation) — vérifié
  // aussi côté serveur (employees.service.js#addEmployee), ceci n'est
  // qu'un confort pour éviter un clic dans le vide.
  const canInvite = !planStatus?.isEffectivelyFreemium;

  function handleAdded(result) {
    setShowAddModal(false);
    if (result.invitationPending) {
      setSuccessMessage(
        `Invitation envoyée à ${result.email}. Elle sera ajoutée automatiquement dès qu'elle créera son compte avec cet e-mail.`
      );
    } else {
      setSuccessMessage(`${result.fullName} a été ajouté(e) à l'équipe en tant que ${ROLE_LABELS[result.roleCode]}.`);
    }
    setTimeout(() => setSuccessMessage(''), 6000);
    loadAll();
  }

  async function handleRemove(employee) {
    if (!window.confirm(`Retirer ${employee.fullName} de l'équipe ?`)) return;
    setBusyId(employee.userId);
    setError('');
    try {
      await apiClient.delete(`/employees/${employee.userId}`);
      loadAll();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Retrait impossible.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancelInvitation(invitation) {
    setBusyId(`inv-${invitation.id}`);
    setError('');
    try {
      await apiClient.delete(`/employees/invitations/${invitation.id}`);
      loadAll();
    } catch (err) {
      setError(err.response?.data?.error?.message || "Impossible d'annuler l'invitation.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Équipe</h1>
          <p className="text-sm text-slate-500">Gérez les employés de votre boutique.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          disabled={!canInvite}
          title={!canInvite ? 'Plan FREEMIUM — passez à un plan payant pour inviter votre équipe' : undefined}
          className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition self-start sm:self-auto disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Ajouter un employé
        </button>
      </div>

      {!loading && !canInvite && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mb-4">
          Votre plan FREEMIUM ne permet aucun employé — passez à un plan payant pour inviter votre équipe.
        </p>
      )}

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

      {loading ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : (
        <>
          {/* --- Équipe actuelle --- */}
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Membres de l'équipe</h2>
            <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3">Nom</th>
                    <th className="text-left px-4 py-3">Contact</th>
                    <th className="text-left px-4 py-3">Rôle</th>
                    <th className="text-right px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.userId} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-800">{employee.fullName}</td>
                      <td className="px-4 py-3 text-slate-500">
                        <div>{employee.email}</div>
                        {employee.phone && <div className="text-xs">{employee.phone}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            employee.roleCode === 'OWNER'
                              ? 'bg-brand-50 text-brand-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {ROLE_LABELS[employee.roleCode]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {employee.roleCode !== 'OWNER' && (
                          <button
                            onClick={() => handleRemove(employee)}
                            disabled={busyId === employee.userId}
                            className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                          >
                            Retirer
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* --- Invitations en attente --- */}
          {invitations.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Invitations en attente</h2>
              <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-3">E-mail</th>
                      <th className="text-left px-4 py-3">Rôle prévu</th>
                      <th className="text-left px-4 py-3">Invité le</th>
                      <th className="text-right px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map((inv) => (
                      <tr key={inv.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 text-slate-700">{inv.email}</td>
                        <td className="px-4 py-3 text-slate-500">{ROLE_LABELS[inv.roleCode]}</td>
                        <td className="px-4 py-3 text-slate-400">{formatDateTime(inv.createdAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleCancelInvitation(inv)}
                            disabled={busyId === `inv-${inv.id}`}
                            className="text-xs font-medium text-slate-500 hover:text-red-600 disabled:opacity-50"
                          >
                            Annuler
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                En attente que la personne crée son compte avec cet e-mail — elle sera alors
                automatiquement ajoutée à cette boutique.
              </p>
            </section>
          )}
        </>
      )}

      {showAddModal && (
        <AddEmployeeModal onClose={() => setShowAddModal(false)} onAdded={handleAdded} />
      )}
    </div>
  );
}