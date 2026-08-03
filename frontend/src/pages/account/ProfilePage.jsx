import { useAuthStore } from '@/store/authStore';

const GENDER_LABELS = { HOMME: 'Homme', FEMME: 'Femme', AUTRE: 'Autre' };

function computeAge(birthDate) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const age = computeAge(user?.birthDate);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-1">Profil</h1>
      <p className="text-sm text-slate-500 mb-6">
        Vos informations personnelles.
      </p>

      <div className="rounded-xl border border-slate-200 bg-white p-6 max-w-md space-y-4">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">Nom complet</p>
          <p className="text-slate-800 font-medium">{user?.fullName}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">E-mail</p>
          <p className="text-slate-800 font-medium">{user?.email}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">Téléphone</p>
          <p className="text-slate-800 font-medium">{user?.phone || '—'}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Sexe</p>
            <p className="text-slate-800 font-medium">
              {user?.gender ? GENDER_LABELS[user.gender] : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Âge</p>
            <p className="text-slate-800 font-medium">{age !== null ? `${age} ans` : '—'}</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-4">
        La modification du profil (nom, mot de passe) sera disponible prochainement.
      </p>
    </div>
  );
}