const env = require('../../config/env');

/**
 * Gabarit HTML partagé par les 5 e-mails transactionnels (§ cahier des
 * charges "Système d'envoi d'e-mails transactionnels", décidé en
 * conversation) — mise en page volontairement sobre (tableau, styles en
 * ligne) pour un rendu fiable dans le plus grand nombre de clients mail,
 * y compris ceux qui ignorent les balises <style>.
 */
function renderEmail({ title, bodyHtml }) {
  const brandName = env.smtp.fromName || 'Gestion Commerciale';
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;max-width:480px;width:100%;">
            <tr>
              <td style="background-color:#0f5e9c;padding:20px 28px;">
                <span style="color:#ffffff;font-size:16px;font-weight:bold;">${escapeHtml(brandName)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;color:#1e293b;font-size:14px;line-height:1.6;">
                <h1 style="font-size:18px;margin:0 0 16px;color:#0b3d63;">${escapeHtml(title)}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background-color:#f8fafc;color:#94a3b8;font-size:12px;">
                Cet e-mail vous a été envoyé automatiquement suite à une action précise sur votre compte ${escapeHtml(brandName)}. Ne répondez pas à cet e-mail.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Bloc de mise en avant du code à 6 chiffres — partagé par la vérification
 * d'e-mail et la réinitialisation de mot de passe (même format, cf. §7.1).
 */
function codeBlockHtml(code) {
  return `
    <div style="text-align:center;margin:20px 0;">
      <span style="display:inline-block;background-color:#eaf3fc;color:#0b3d63;font-size:28px;font-weight:bold;letter-spacing:6px;padding:14px 24px;border-radius:8px;">${escapeHtml(code)}</span>
    </div>
    <p style="color:#64748b;font-size:13px;">Ce code est valable 15 minutes et ne peut être utilisé qu'une seule fois.</p>`;
}

function verificationCodeEmail({ code }) {
  return {
    subject: 'Votre code de vérification',
    html: renderEmail({
      title: 'Confirmez votre adresse e-mail',
      bodyHtml: `
        <p>Merci de votre inscription. Pour activer votre compte, entrez le code suivant :</p>
        ${codeBlockHtml(code)}
        <p style="color:#64748b;font-size:13px;">Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement cet e-mail.</p>`,
    }),
  };
}

function passwordResetEmail({ code }) {
  return {
    subject: 'Réinitialisation de votre mot de passe',
    html: renderEmail({
      title: 'Réinitialisez votre mot de passe',
      bodyHtml: `
        <p>Une demande de réinitialisation de mot de passe a été faite pour ce compte. Entrez le code suivant pour choisir un nouveau mot de passe :</p>
        ${codeBlockHtml(code)}
        <p style="color:#64748b;font-size:13px;">Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet e-mail — votre mot de passe reste inchangé.</p>`,
    }),
  };
}

function employeeInvitedEmail({ storeName, roleLabel }) {
  return {
    subject: `Vous avez été invité(e) à rejoindre ${storeName}`,
    html: renderEmail({
      title: 'Une boutique vous invite à rejoindre son équipe',
      bodyHtml: `
        <p>Vous avez été invité(e) à rejoindre <strong>${escapeHtml(storeName)}</strong> en tant que <strong>${escapeHtml(roleLabel)}</strong>.</p>
        <p>Pour rejoindre l'équipe, créez simplement votre compte avec cette même adresse e-mail — vous serez automatiquement rattaché(e) à la boutique.</p>
        <p style="color:#64748b;font-size:13px;">Si vous ne connaissez pas cette boutique, vous pouvez ignorer cet e-mail sans risque.</p>`,
    }),
  };
}

function invitationAcceptedEmail({ inviteeName, storeName }) {
  return {
    subject: `${inviteeName} a rejoint votre équipe`,
    html: renderEmail({
      title: 'Votre invitation a été acceptée',
      bodyHtml: `<p><strong>${escapeHtml(inviteeName)}</strong> a rejoint <strong>${escapeHtml(storeName)}</strong>.</p>`,
    }),
  };
}

const PLAN_ACTION_TEXT = {
  ACTIVATED: (planName) => `Votre boutique est passée au plan <strong>${escapeHtml(planName)}</strong>.`,
  RENEWED: (planName) => `L'abonnement au plan <strong>${escapeHtml(planName)}</strong> de votre boutique a été renouvelé.`,
  DEACTIVATED: (planName) => `Votre boutique est repassée au plan <strong>${escapeHtml(planName)}</strong>.`,
};

function planChangedEmail({ storeName, planName, action, expiresAt }) {
  const text = PLAN_ACTION_TEXT[action](planName);
  const expiryLine =
    action !== 'DEACTIVATED' && expiresAt
      ? `<p style="color:#64748b;font-size:13px;">Valable jusqu'au ${new Date(expiresAt).toLocaleDateString('fr-FR')}.</p>`
      : '';
  return {
    subject: `Mise à jour de l'abonnement de ${storeName}`,
    html: renderEmail({
      title: 'Abonnement mis à jour',
      bodyHtml: `<p>${text}</p>${expiryLine}<p style="color:#64748b;font-size:13px;">Aucune action n'est requise de votre part.</p>`,
    }),
  };
}

module.exports = {
  verificationCodeEmail,
  passwordResetEmail,
  employeeInvitedEmail,
  invitationAcceptedEmail,
  planChangedEmail,
};
