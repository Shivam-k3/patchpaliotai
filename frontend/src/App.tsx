import { useEffect, useState } from 'react'

const API = 'http://localhost:8000'

const readError = async (res: Response) => {
  const text = await res.text()
  try {
    const data = JSON.parse(text)
    return data.detail || text
  } catch {
    return text
  }
}

export default function App() {
  const [samples, setSamples] = useState<string[]>([])
  const [sample, setSample] = useState('')
  const [bug, setBug] = useState('')
  const [patch, setPatch] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadSamples = async () => {
      try {
        const res = await fetch(`${API}/api/samples`)
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        const list: string[] = Array.isArray(data.samples) ? data.samples : []
        setSamples(list)
        setSample(prev => (prev || list[0] || ''))
      } catch (e:any) {
        setError(e.message)
      }
    }
    loadSamples()
  }, [])

  const analyze = async () => {
    setAnalyzing(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/analyze`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({bug_report: bug, sample_name: sample || undefined})
      })
      if (!res.ok) throw new Error(await readError(res))
      const data = await res.json()
      if (!data.proposed_unified_diff) throw new Error('model returned no proposed_unified_diff')
      setPatch(data.proposed_unified_diff)
    } catch (e:any) {
      setError(e.message)
    } finally {
      setAnalyzing(false)
    }
  }

  const verify = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/verify`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({sample_name: sample, patch_text: patch})
      })
      if (!res.ok) throw new Error(await readError(res))
      setResult(await res.json())
    } catch (e:any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">PatchPilot AI</h1>
      <div className="mb-2">
        <label className="block text-sm">Sample</label>
        <select value={sample} onChange={e=>setSample(e.target.value)} className="border p-2 w-full">
          {samples.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="mb-2">
        <label className="block text-sm">Bug report (required for Analyze)</label>
        <div className="flex gap-2 items-start">
          <textarea value={bug} onChange={e=>setBug(e.target.value)} className="border p-2 w-full" rows={3} />
          <button onClick={analyze} disabled={analyzing || !bug.trim()} className="border border-blue-600 text-blue-700 px-4 py-2 rounded whitespace-nowrap">
            {analyzing ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </div>
      <div className="mb-2">
        <label className="block text-sm">Patch (unified diff)</label>
        <textarea value={patch} onChange={e=>setPatch(e.target.value)} className="border p-2 w-full font-mono" rows={10} />
      </div>
      <button onClick={verify} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded">Verify</button>
      {error && <div className="text-red-600 mt-2">{error}</div>}
      {result && (
        <div className="mt-4 border p-4">
          <div className="font-bold">Classification: {result.classification}</div>
          {result.error && <div className="text-red-600">Error: {result.error}</div>}
          <div className="mt-2">
            <div className="font-semibold">Baseline</div>
            <pre className="text-xs bg-gray-100 p-2 overflow-auto">{JSON.stringify(result.baseline, null, 2)}</pre>
          </div>
          <div className="mt-2">
            <div className="font-semibold">Patched</div>
            <pre className="text-xs bg-gray-100 p-2 overflow-auto">{JSON.stringify(result.patched, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
