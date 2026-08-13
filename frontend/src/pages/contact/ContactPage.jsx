import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import { MessageCircleQuestion, Send, MessageCircle, Phone, Mail, Globe, Users, GraduationCap } from 'lucide-react';
import TutorialModal from './TutorialModal';

const ICONS = {
  WHATSAPP: MessageCircle,
  TELEGRAM: Send,
  PHONE: Phone,
  EMAIL: Mail,
  OTHER: Globe,
};

const OTHER_VALUE = '__OTHER__';

export default function ContactPage() {
  const [categories, setCategories] = useState([]);
  const [subjectChoice, setSubjectChoice] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [links, setLinks] = useState([]);
  const [linksLoading, setLinksLoading] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await apiClient.get('/contact/subject-categories');
        setCategories(data.categories);
        setSubjectChoice(data.categories[0] || '');
      } catch {
        // Silencieux : un select vide reste utilisable via "Autre".
      }
    })();
    (async () => {
      setLinksLoading(true);
      try {
        const { data } = await apiClient.get('/contact/social-links');
        setLinks(data.links);
      } catch {
        // Section communauté simplement absente si le chargement échoue.
      } finally {
        setLinksLoading(false);
      }
    })();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const subject = subjectChoice === OTHER_VALUE ? customSubject.trim() : subjectChoice;
    if (!subject) {
      setError("Précisez l'objet de votre message.");
      return;
    }
    if (!message.trim()) {
      setError('Décrivez votre demande avant de l\'envoyer.');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/contact/messages', { subject, message: message.trim() });
      setSuccess('Votre message a bien été envoyé — nous reviendrons vers vous rapidement.');
      setMessage('');
      setCustomSubject('');
      setSubjectChoice(categories[0] || '');
    } catch (err) {
      setError(err.response?.data?.error?.message || "Impossible d'envoyer le message.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <MessageCircleQuestion className="h-6 w-6 text-brand-500" strokeWidth={1.75} />
          <h1 className="text-2xl font-semibold text-slate-800">Contactez-nous</h1>
        </div>
        <button
          onClick={() => setShowTutorial(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-50 text-brand-700 text-sm font-medium px-4 py-2 hover:bg-brand-100 transition"
        >
          <GraduationCap size={16} strokeWidth={1.75} />
          Voir le tutoriel
        </button>
      </div>
      <p className="text-sm text-slate-500 -mt-4">
        Une question, un problème, une suggestion ? Écrivez-nous directement depuis cet écran.
      </p>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2">
              {success}
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Objet</label>
            <select
              value={subjectChoice}
              onChange={(e) => setSubjectChoice(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={OTHER_VALUE}>Autre</option>
            </select>
          </div>

          {subjectChoice === OTHER_VALUE && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Précisez l'objet</label>
              <input
                type="text"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                placeholder="Votre objet"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Votre message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Décrivez votre problème ou votre question..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-500 text-white text-sm font-medium px-5 py-2.5 hover:bg-brand-600 transition disabled:opacity-60"
          >
            {submitting ? 'Envoi...' : 'Envoyer'}
          </button>
        </form>
      </section>

      {!linksLoading && links.length > 0 && (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-indigo-500" strokeWidth={1.75} />
            <h2 className="text-sm font-semibold text-slate-700">Rejoignez la communauté</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {links.map((link) => {
              const Icon = ICONS[link.iconKey] || Globe;
              return (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 hover:border-brand-300 hover:bg-brand-50/40 transition"
                >
                  <div className="h-9 w-9 shrink-0 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                    <Icon size={18} strokeWidth={1.75} />
                  </div>
                  <span className="text-sm font-medium text-slate-700">{link.label}</span>
                </a>
              );
            })}
          </div>
        </section>
      )}

      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
    </div>
  );
}
