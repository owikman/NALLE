'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Invoice {
  id: string
  type: 'sent' | 'received'
  invoice_number: string | null
  counterparty: string
  description: string | null
  amount: number
  vat_amount: number
  issue_date: string
  due_date: string | null
  paid_date: string | null
  status: 'unpaid' | 'paid' | 'overdue'
}

const fmt = (n: number) => new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(n)
const today = new Date().toISOString().split('T')[0]!

function isOverdue(inv: Invoice) {
  return inv.status === 'unpaid' && inv.due_date && inv.due_date < today
}

type Tab = 'sent' | 'received'

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [tab, setTab] = useState<Tab>('sent')
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  async function load() {
    const res = await fetch('/api/invoices')
    const data = await res.json()
    setInvoices(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function markPaid(inv: Invoice) {
    setActing(inv.id)
    await fetch(`/api/invoices/${inv.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paid', paid_date: today }),
    })
    await load()
    setActing(null)
  }

  async function markUnpaid(inv: Invoice) {
    setActing(inv.id)
    await fetch(`/api/invoices/${inv.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'unpaid', paid_date: null }),
    })
    await load()
    setActing(null)
  }

  async function del(inv: Invoice) {
    if (!confirm(`Delete invoice from ${inv.counterparty}?`)) return
    setActing(inv.id)
    await fetch(`/api/invoices/${inv.id}`, { method: 'DELETE' })
    await load()
    setActing(null)
  }

  const sent = invoices.filter(i => i.type === 'sent')
  const received = invoices.filter(i => i.type === 'received')
  const visible = tab === 'sent' ? sent : received

  const totalReceivable = sent.filter(i => i.status === 'unpaid').reduce((s, i) => s + i.amount + i.vat_amount, 0)
  const totalPayable = received.filter(i => i.status === 'unpaid').reduce((s, i) => s + i.amount + i.vat_amount, 0)
  const collectedThisMonth = sent.filter(i => i.status === 'paid' && i.paid_date?.startsWith(today.slice(0, 7))).reduce((s, i) => s + i.amount + i.vat_amount, 0)

  return (
    <div style={{ maxWidth: 800 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Invoices</h1>
          <p style={{ fontSize: 14, color: '#9ca3af' }}>Track money in and money out</p>
        </div>
        <Link href="/invoices/new" style={{ background: '#2563eb', color: 'white', borderRadius: 12, padding: '11px 20px', fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          + New invoice
        </Link>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 28 }}>
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Outstanding receivable</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: totalReceivable > 0 ? '#2563eb' : '#111827' }}>{fmt(totalReceivable)}</p>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{sent.filter(i => i.status === 'unpaid').length} unpaid invoices</p>
        </div>
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Collected this month</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>{fmt(collectedThisMonth)}</p>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{sent.filter(i => i.status === 'paid' && i.paid_date?.startsWith(today.slice(0, 7))).length} invoices paid</p>
        </div>
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>You owe suppliers</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: totalPayable > 0 ? '#dc2626' : '#111827' }}>{fmt(totalPayable)}</p>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{received.filter(i => i.status === 'unpaid').length} unpaid bills</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 12, padding: 4, marginBottom: 20, width: 'fit-content' }}>
        {(['sent', 'received'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, background: tab === t ? 'white' : 'transparent', color: tab === t ? '#111827' : '#6b7280', boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
            {t === 'sent' ? '↑ Sent (money in)' : '↓ Received (money out)'}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ background: 'white', borderRadius: 20, border: '1px solid #f0f0f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Loading...</div>
        ) : visible.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>{tab === 'sent' ? '📤' : '📥'}</p>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 6 }}>No {tab === 'sent' ? 'sent' : 'received'} invoices yet</p>
            <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 20 }}>{tab === 'sent' ? "Add invoices you've sent to clients" : "Add bills you've received from suppliers"}</p>
            <Link href="/invoices/new" style={{ background: '#2563eb', color: 'white', borderRadius: 12, padding: '11px 22px', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
              + Add invoice
            </Link>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 12, padding: '12px 24px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
              {['Counterparty', 'Amount (incl. VAT)', 'Due date', 'Status', ''].map(h => (
                <p key={h} style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</p>
              ))}
            </div>

            {visible.map((inv, i) => {
              const overdue = isOverdue(inv)
              const total = inv.amount + inv.vat_amount
              const isLast = i === visible.length - 1
              return (
                <div key={inv.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 12, padding: '16px 24px', borderBottom: isLast ? 'none' : '1px solid #f9fafb', alignItems: 'center', opacity: acting === inv.id ? 0.5 : 1 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{inv.counterparty}</p>
                    {inv.invoice_number && <p style={{ fontSize: 12, color: '#9ca3af' }}>#{inv.invoice_number}</p>}
                    {inv.description && <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{inv.description}</p>}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{fmt(total)}</p>
                    {inv.vat_amount > 0 && <p style={{ fontSize: 11, color: '#9ca3af' }}>net {fmt(inv.amount)} + VAT {fmt(inv.vat_amount)}</p>}
                  </div>
                  <p style={{ fontSize: 13, color: overdue ? '#dc2626' : '#6b7280' }}>
                    {inv.due_date ? new Date(inv.due_date).toLocaleDateString('fi-FI') : '—'}
                    {overdue && <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#dc2626' }}>Overdue</span>}
                  </p>
                  <div>
                    {inv.status === 'paid' ? (
                      <span style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 99, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>Paid</span>
                    ) : overdue ? (
                      <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 99, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>Overdue</span>
                    ) : (
                      <span style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', borderRadius: 99, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>Unpaid</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {inv.status === 'paid' ? (
                      <button onClick={() => markUnpaid(inv)} disabled={acting === inv.id}
                        style={{ fontSize: 12, color: '#9ca3af', background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}>
                        Unmark
                      </button>
                    ) : (
                      <button onClick={() => markPaid(inv)} disabled={acting === inv.id}
                        style={{ fontSize: 12, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontWeight: 600 }}>
                        Mark paid
                      </button>
                    )}
                    <button onClick={() => del(inv)} disabled={acting === inv.id}
                      style={{ fontSize: 13, color: '#d1d5db', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' }}>
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
