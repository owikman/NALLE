'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { WizardField, WizardGroup } from '@/lib/ledger/wizard-questions'

type ResponseRow = { question_key: string; group_key: string; answer_value: unknown; status: 'unanswered' | 'answered' | 'unknown'; answered_at: string | null }
type LocalAnswer = { value: string | boolean | null; unknown: boolean }

const inputStyle = { width: '100%', border: '1px solid #e5e7eb', borderRadius: 12, padding: '13px 16px', fontSize: 15, outline: 'none', boxSizing: 'border-box' as const, color: '#111827' }
const labelStyle = { display: 'block', fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 } as const
const helpStyle = { fontSize: 13, color: '#9ca3af', marginBottom: 10, lineHeight: 1.5 } as const

function fieldDefaultLocal(field: WizardField): LocalAnswer {
  if (field.type === 'boolean') return { value: null, unknown: false }
  if (field.type === 'select') return { value: field.options?.[0]?.value ?? '', unknown: false }
  return { value: '', unknown: false }
}

function WizardForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [groups, setGroups] = useState<WizardGroup[]>([])
  const [groupIndex, setGroupIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openingPosted, setOpeningPosted] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/tase/setup-responses').then(async res => {
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to load'); setLoading(false); return }

      const loadedGroups: WizardGroup[] = json.groups
      setGroups(loadedGroups)

      const initial: Record<string, LocalAnswer> = {}
      for (const group of loadedGroups) {
        for (const field of group.fields) initial[field.key] = fieldDefaultLocal(field)
      }
      for (const r of json.responses as ResponseRow[]) {
        if (r.status === 'unknown') initial[r.question_key] = { value: null, unknown: true }
        else if (r.status === 'answered') initial[r.question_key] = { value: r.answer_value as string | boolean, unknown: false }
      }
      setAnswers(initial)

      const requestedGroup = searchParams.get('group')
      const requestedIndex = loadedGroups.findIndex(g => g.key === requestedGroup)
      if (requestedIndex >= 0) {
        setGroupIndex(requestedIndex)
      } else {
        const firstIncomplete = loadedGroups.findIndex(g =>
          g.fields.some(f => {
            const r = (json.responses as ResponseRow[]).find(x => x.question_key === f.key)
            return !r || r.status === 'unanswered'
          })
        )
        setGroupIndex(firstIncomplete >= 0 ? firstIncomplete : 0)
      }
      setLoading(false)
    })
  }, [searchParams])

  if (loading) return <div style={{ padding: 40, color: '#9ca3af' }}>Loading...</div>
  if (error) return <div style={{ padding: 40, color: '#dc2626' }}>{error}</div>
  if (groups.length === 0) return <div style={{ padding: 40, color: '#9ca3af' }}>Nothing to set up right now.</div>

  const group = groups[groupIndex]!
  const progress = (groupIndex / groups.length) * 100

  function setValue(key: string, value: string | boolean | null) {
    setAnswers(a => ({ ...a, [key]: { value, unknown: false } }))
  }

  function setUnknown(key: string, unknown: boolean) {
    setAnswers(a => ({ ...a, [key]: { value: unknown ? null : a[key]?.value ?? '', unknown } }))
  }

  async function handleSave() {
    for (const field of group.fields) {
      const a = answers[field.key]
      if (field.required && !a?.unknown && (a?.value === '' || a?.value === null || a?.value === undefined)) {
        setError(`Please answer "${field.label}" or mark it as unknown.`)
        return
      }
    }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/tase/setup-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_key: group.key,
          answers: group.fields.map(f => ({
            question_key: f.key,
            value: answers[f.key]?.unknown ? undefined : answers[f.key]?.value,
            unknown: Boolean(answers[f.key]?.unknown),
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save')
      if (json.postingError) throw new Error(`Saved your answer, but the ledger update failed: ${json.postingError}`)
      if ('openingEntryPosted' in json) setOpeningPosted(json.openingEntryPosted)

      if (groupIndex < groups.length - 1) {
        setGroupIndex(i => i + 1)
        setSaving(false)
      } else {
        router.push('/tase')
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  function handleBack() {
    if (groupIndex === 0) { router.back(); return }
    setGroupIndex(i => i - 1)
    setError(null)
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', paddingTop: 40 }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Get my tase ready</span>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>{groupIndex + 1} / {groups.length}</span>
        </div>
        <div style={{ height: 2, background: '#f3f4f6', borderRadius: 99 }}>
          <div style={{ height: '100%', background: '#3b82f6', borderRadius: 99, width: `${progress}%`, transition: 'width 0.3s ease' }} />
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 20, border: '1px solid #f0f0f0', padding: '40px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#111827', marginBottom: 6 }}>{group.title}</h2>
        {group.intro && <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 28, lineHeight: 1.6 }}>{group.intro}</p>}
        {!group.intro && <div style={{ marginBottom: 20 }} />}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          {group.fields.map(field => {
            const a = answers[field.key] ?? fieldDefaultLocal(field)
            return (
              <div key={field.key}>
                <label style={labelStyle}>{field.label}</label>
                {field.help && <p style={helpStyle}>{field.help}</p>}

                {!a.unknown && field.type === 'text' && (
                  <input type="text" value={(a.value as string) ?? ''} onChange={e => setValue(field.key, e.target.value)} style={inputStyle} />
                )}
                {!a.unknown && field.type === 'date' && (
                  <input type="date" value={(a.value as string) ?? ''} onChange={e => setValue(field.key, e.target.value)} style={inputStyle} />
                )}
                {!a.unknown && field.type === 'number' && (
                  <input type="number" value={(a.value as string) ?? ''} onChange={e => setValue(field.key, e.target.value)} style={inputStyle} />
                )}
                {!a.unknown && field.type === 'currency' && (
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontWeight: 500 }}>€</span>
                    <input type="number" step="0.01" value={(a.value as string) ?? ''} onChange={e => setValue(field.key, e.target.value)} placeholder="0.00" style={{ ...inputStyle, paddingLeft: 32 }} />
                  </div>
                )}
                {!a.unknown && field.type === 'select' && (
                  <select value={(a.value as string) ?? ''} onChange={e => setValue(field.key, e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    {field.options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                )}
                {!a.unknown && field.type === 'boolean' && (
                  <div style={{ display: 'flex', gap: 12 }}>
                    {[{ value: true, label: 'Yes' }, { value: false, label: 'No' }].map(opt => (
                      <button key={String(opt.value)} type="button" onClick={() => setValue(field.key, opt.value)}
                        style={{ flex: 1, padding: '13px', borderRadius: 12, border: a.value === opt.value ? '1.5px solid #3b82f6' : '1px solid #e5e7eb', background: a.value === opt.value ? '#eff6ff' : 'white', color: a.value === opt.value ? '#1d4ed8' : '#374151', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                {field.unknownAllowed && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={a.unknown} onChange={e => setUnknown(field.key, e.target.checked)} />
                    <span style={{ fontSize: 13, color: '#9ca3af' }}>I don&apos;t know — remind me later</span>
                  </label>
                )}
              </div>
            )
          })}
        </div>

        {error && <p style={{ marginTop: 20, fontSize: 13, color: '#ef4444' }}>{error}</p>}
        {openingPosted === false && groupIndex === groups.length - 1 && (
          <p style={{ marginTop: 20, fontSize: 13, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px' }}>
            Some opening-balance questions are still unanswered or marked unknown, so your tase will show as &quot;Missing information&quot; until those are resolved.
          </p>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
          <button onClick={handleBack} style={{ padding: '14px 24px', borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 14, fontWeight: 500, color: '#6b7280', background: 'white', cursor: 'pointer' }}>
            Back
          </button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, background: '#2563eb', color: 'white', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 600, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving...' : groupIndex === groups.length - 1 ? 'Finish' : 'Save and continue →'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 24 }}>
        {groups.map((g, i) => (
          <div key={g.key} style={{ height: 4, borderRadius: 99, transition: 'all 0.2s', width: i === groupIndex ? 24 : 4, background: i === groupIndex ? '#3b82f6' : i < groupIndex ? '#bfdbfe' : '#e5e7eb' }} />
        ))}
      </div>
    </div>
  )
}

export default function TaseWizardPage() {
  return (
    <Suspense>
      <WizardForm />
    </Suspense>
  )
}
