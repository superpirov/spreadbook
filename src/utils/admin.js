// Owner allowlist for the admin panel (/app/admin).
// TODO: put your login email here (the one you use to sign in).
export const ADMIN_EMAILS = ['owner@example.com']

export const isAdmin = (user) =>
  !!user?.email && ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(String(user.email).toLowerCase())
