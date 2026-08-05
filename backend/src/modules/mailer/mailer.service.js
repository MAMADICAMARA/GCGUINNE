const nodemailer = require('nodemailer');
const env = require('../../config/env');

/**
 * Envoi d'e-mails transactionnels via SMTP Gmail (§ cahier des charges
 * "Système d'envoi d'e-mails transactionnels", décidé en conversation).
 * Transporteur instancié PARESSEUSEMENT (jamais au chargement du module),
 * même principe que `config/r2.js#getR2Client` : si SMTP n'est pas
 * configuré, le reste de l'application démarre quand même normalement.
 *
 * `sendEmail` n'est JAMAIS awaité par les appelants (§9 du cahier des
 * charges — l'envoi ne doit jamais retarder la réponse HTTP) : elle attrape
 * elle-même toute erreur et se contente de la journaliser, ne renvoie
 * jamais un rejet non attrapé. Un appelant fait simplement
 * `mailer.sendEmail({...})` sans `await` ni `.catch()`.
 */
let cachedTransporter = null;

function isMailerConfigured() {
  return Boolean(env.smtp.host && env.smtp.port && env.smtp.user && env.smtp.password);
}

function getTransporter() {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.password },
    });
  }
  return cachedTransporter;
}

async function sendEmail({ to, subject, html }) {
  if (!isMailerConfigured()) {
    // eslint-disable-next-line no-console
    console.error(`Envoi d'e-mail ignoré (SMTP non configuré) — destinataire : ${to}, sujet : ${subject}`);
    return;
  }

  try {
    await getTransporter().sendMail({
      from: `"${env.smtp.fromName || 'Gestion Commerciale'}" <${env.smtp.fromAddress || env.smtp.user}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    // Jamais de code (ni de mot de passe) journalisé en clair — seul le
    // message d'erreur SMTP est utile pour diagnostiquer (§8 du cahier des
    // charges : ne jamais journaliser les codes en clair).
    // eslint-disable-next-line no-console
    console.error(`Échec de l'envoi d'e-mail à ${to} :`, err.message);
  }
}

module.exports = { sendEmail, isMailerConfigured };
