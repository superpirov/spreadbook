import Billing from '../components/Billing.jsx'

export default function BillingPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Тариф и оплата</h1>
        <p className="text-sm text-slate-400">Пробный доступ, PRO-подписка и проверка платежа в блокчейне.</p>
      </div>
      <Billing />
    </div>
  )
}
