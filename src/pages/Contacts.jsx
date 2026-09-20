import CounterpartyList from '../components/CounterpartyList.jsx'

export default function Contacts() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Контрагенты</h1>
        <p className="text-sm text-slate-400">CRM по людям: оборот, история сделок, рейтинг надежности.</p>
      </div>
      <CounterpartyList />
    </div>
  )
}
