/**
 * Convertit un lien YouTube ou Vimeo "normal" (collé tel quel par le Super
 * Admin) en URL embarquable dans un <iframe> — jamais l'inverse : on ne
 * demande jamais à l'admin de connaître le format d'intégration. Renvoie
 * null si le lien n'est reconnu ni comme YouTube ni comme Vimeo, auquel
 * cas l'appelant doit proposer un simple lien de secours plutôt qu'un
 * lecteur cassé.
 */
export function getEmbeddableVideoUrl(url) {
  if (!url) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, '');

  if (host === 'youtu.be') {
    const id = parsed.pathname.slice(1);
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (parsed.pathname.startsWith('/embed/')) return url;
    if (parsed.pathname.startsWith('/shorts/')) {
      const id = parsed.pathname.split('/')[2];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    const id = parsed.searchParams.get('v');
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  if (host === 'vimeo.com') {
    const id = parsed.pathname.split('/').filter(Boolean)[0];
    return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
  }

  if (host === 'player.vimeo.com') {
    return url;
  }

  return null;
}
