import { useStore } from '../store/useStore.js'
import DealForm from '../components/DealForm.jsx'
import TransactionTable from '../components/TransactionTable.jsx'

export default function Deals() {
  const deals = useStore((s) => s.deals)
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Сделки</h1>
        <p className="text-sm text-slate-400">Быстрый ввод и полный журнал с фильтрами и пагинацией.</p>
      </div>
      <DealForm key="new" />
      <TransactionTable deals={deals} />
    </div>
  )
}
