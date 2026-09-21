// Owner allowlist for the admin panel (/app/admin).
export const ADMIN_EMAILS = ['pirov.ru@yandex.ru']

export const isAdmin = (user) =>
  !!user?.email && ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(String(user.email).toLowerCase())
