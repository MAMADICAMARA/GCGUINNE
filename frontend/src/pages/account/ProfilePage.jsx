import { useAuthStore } from '@/store/authStore';

const GENDER_LABELS = { HOMME: 'Homme', FEMME: 'Femme', AUTRE: 'Autre' };

// Palette dérivée de la charte existante (brand = bleu) + tons complémentaires
// harmonieux, pour donner un avatar coloré et distinctif à chaque personne
// sans jamais sortir de l'identité visuelle déjà établie dans l'app.
const AVATAR_PALETTE = [
  { bg: 'bg-brand-50', text: 'text-brand-600', ring: 'ring-brand-100' },
  { bg: 'bg-teal-50', text: 'text-teal-600', ring: 'ring-teal-100' },
  { bg: 'bg-violet-50', text: 'text-violet-600', ring: 'ring-violet-100' },
  { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-100' },
  { bg: 'bg-rose-50', text: 'text-rose-600', ring: 'ring-rose-100' },
  { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
];

function getInitials(fullName) {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

// Couleur stable pour une même personne (basée sur son nom, pas aléatoire à
// chaque rendu) — un simple hash de caractères suffit ici.
function getAvatarStyle(fullName) {
  if (!fullName) return AVATAR_PALETTE[0];
  const hash = fullName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

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

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-center gap-4 py-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate text-sm font-medium text-slate-800">{value}</p>
      </div>
    </div>
  );
}

const ICONS = {
  mail: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 6-10 7L2 6" />
    </svg>
  ),
  phone: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.804 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
    </svg>
  ),
  user: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M6 21v-1a6 6 0 0 1 12 0v1" />
    </svg>
  ),
  cake: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
      <path d="M4 16s.5-1 2-1 2 1 3.5 1 2-1 3.5-1 2 1 3.5 1 2-1 3.5-1" />
      <path d="M12 8v3M12 4a1.5 1.5 0 1 0-1.5-1.5A1.5 1.5 0 0 0 12 4Z" />
    </svg>
  ),
};

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const age = computeAge(user?.birthDate);
  const initials = getInitials(user?.fullName);
  const avatar = getAvatarStyle(user?.fullName);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-1">Profil</h1>
      <p className="text-sm text-slate-500 mb-6">Vos informations personnelles.</p>

      <div className="max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white">
        {/* En-tête signature : avatar à initiales, coloré de façon stable
            selon le nom — donne une identité visuelle à chaque personne
            sans jamais sortir de la palette déjà établie dans l'app. */}
        <div className="flex items-center gap-4 border-b border-slate-100 bg-slate-50/60 px-6 py-6">
          <div
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-semibold ring-4 ${avatar.bg} ${avatar.text} ${avatar.ring}`}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-800">
              {user?.fullName || 'Utilisateur'}
            </p>
            <p className="truncate text-sm text-slate-500">{user?.email}</p>
          </div>
        </div>

        <div className="divide-y divide-slate-100 px-6">
          <InfoRow icon={ICONS.mail} label="E-mail" value={user?.email || '—'} />
          <InfoRow icon={ICONS.phone} label="Téléphone" value={user?.phone || '—'} />
          <InfoRow
            icon={ICONS.user}
            label="Sexe"
            value={user?.gender ? GENDER_LABELS[user.gender] : '—'}
          />
          <InfoRow icon={ICONS.cake} label="Âge" value={age !== null ? `${age} ans` : '—'} />
        </div>
      </div>

      <div className="mt-4 flex max-w-md items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          className="mt-0.5 shrink-0 text-slate-400"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        <p className="text-xs leading-relaxed text-slate-500">
          La modification du profil (nom, mot de passe) sera disponible prochainement.
        </p>
      </div>
    </div>
  );
}