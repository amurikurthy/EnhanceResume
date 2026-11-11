// Runtime configuration, read from environment variables on every call (so tests can change it).
const bool = (v, d) => (v === undefined || v === '' ? d : /^(1|true|yes|on)$/i.test(String(v)));

function cfg() {
  const env = process.env;
  const issuer = (env.OIDC_ISSUER || '').trim();
  const oidc = issuer && env.OIDC_CLIENT_ID && env.OIDC_CLIENT_SECRET ? {
    issuer,
    clientId: env.OIDC_CLIENT_ID.trim(),
    clientSecret: env.OIDC_CLIENT_SECRET.trim(),
    scopes: (env.OIDC_SCOPES || 'openid profile email').trim(),
    label: env.OIDC_BUTTON_LABEL || 'Sign in with Authentik',
    autoCreate: bool(env.OIDC_AUTO_CREATE, true),
    trustEmail: bool(env.OIDC_TRUST_EMAIL, true),
    adminGroup: (env.OIDC_ADMIN_GROUP || '').trim(),
    redirectUri: (env.OIDC_REDIRECT_URI || (env.PUBLIC_URL ? env.PUBLIC_URL.replace(/\/+$/, '') + '/api/auth/oidc/callback' : '')).trim(),
  } : null;
  return {
    adminEmail: (env.ADMIN_EMAIL || '').trim().toLowerCase(),
    adminPassword: env.ADMIN_PASSWORD || '',
    adminName: (env.ADMIN_NAME || 'Administrator').trim(),
    allowRegistration: bool(env.ALLOW_REGISTRATION, true),
    oidc,
    // password sign-in can only be turned off when SSO is configured; the ADMIN_EMAIL account always keeps it (break-glass)
    passwordLoginDisabled: !!oidc && bool(env.DISABLE_PASSWORD_LOGIN, false),
  };
}
module.exports = { cfg };
