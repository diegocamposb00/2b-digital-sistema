import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// ── Risk logic ────────────────────────────────────────────────
function calcAutoRisk(field, value) {
  if (!value && value !== 0) return ''
  if (field === 'Versión PHP') return value === 'Desactualizado' ? 'Alto' : 'Bajo'
  if (field === 'Plugins desactualizados (cantidad)') return Number(value) > 5 ? 'Medio' : 'Bajo'
  if (field === 'Uso disco (%)') return Number(value) > 80 ? 'Alto' : 'Bajo'
  if (field === 'Certificado SSL válido') return value === 'No' ? 'Crítico' : 'Bajo'
  if (field === 'Backups visibles') return value === 'No' ? 'Alto' : 'Bajo'
  return ''
}
const AUTO_RISK_FIELDS = ['Versión PHP','Plugins desactualizados (cantidad)','Uso disco (%)','Certificado SSL válido','Backups visibles']

function calcFinalRisk(items) {
  const risks = items.map(i => i.riesgo).filter(Boolean)
  if (risks.includes('Crítico')) return 'Crítico'
  if (risks.includes('Alto')) return 'Alto'
  if (risks.includes('Medio')) return 'Medio'
  if (risks.length) return 'Bajo'
  return '—'
}

function calcCotizacion(v) {
  const diag = 690000 + (v.infraestructura === 'VPS complejo' ? 200000 : 0) + (v.correos === 'Sí' ? 150000 : 0)
  const plan = 380000 + (v.ecommerce === 'Sí' ? 120000 : 0) + (Number(v.productos) > 500 ? 100000 : 0)
  return { diag, plan, total: diag + plan }
}

const fmt = n => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

// ── Checklist structure ───────────────────────────────────────
const SECTIONS = [
  { cat: 'WordPress', items: ['Versión WP','Versión PHP','Plugins desactualizados (cantidad)','Tema activo y versión','Plugins abandonados','Botones rotos visibles','Formularios funcionando'] },
  { cat: 'Infraestructura', items: ['Tipo hosting / VPS','Uso disco (%)','Uso RAM estimado','Certificado SSL válido','Fecha expiración dominio','Backups visibles'] },
  { cat: 'Seguridad', items: ['Firewall activo','Escaneo malware','Permisos sospechosos','Intentos login excesivos'] },
  { cat: 'Performance', items: ['PageSpeed móvil','Tiempo de carga real','Peso homepage (MB)','LCP aproximado'] },
  { cat: 'Correos', items: ['SPF configurado','DKIM configurado','DMARC configurado','¿Correos en mismo servidor?'] },
]
const ALL_ITEMS = SECTIONS.flatMap(s => s.items)

// ── UI Components ─────────────────────────────────────────────
const RISK_STYLES = {
  'Crítico': 'bg-red-50 text-red-700 border border-red-200',
  'Alto':    'bg-orange-50 text-orange-700 border border-orange-200',
  'Medio':   'bg-amber-50 text-amber-700 border border-amber-200',
  'Bajo':    'bg-emerald-50 text-emerald-700 border border-emerald-200',
  '—':       'bg-gray-100 text-gray-400 border border-gray-200',
}

const Badge = ({ level }) => (
  <span className={`text-xs font-bold px-2.5 py-1 rounded-full tracking-wide ${RISK_STYLES[level] || RISK_STYLES['—']}`}>{level || '—'}</span>
)

const Input = ({ value, onChange, placeholder, type = 'text', className = '' }) => (
  <input
    type={type} value={value ?? ''} onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className={`w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-400 transition ${className}`}
  />
)

const Select = ({ value, onChange, options, placeholder }) => (
  <select value={value ?? ''} onChange={e => onChange(e.target.value)}
    className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:border-stone-400 transition">
    <option value="">{placeholder || 'Seleccionar...'}</option>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
)

const Btn = ({ onClick, children, variant = 'primary', disabled, className = '' }) => {
  const styles = {
    primary: 'bg-stone-900 text-white hover:bg-stone-700',
    outline: 'border border-stone-300 text-stone-700 hover:bg-stone-50',
    danger:  'bg-red-600 text-white hover:bg-red-700',
    ghost:   'text-stone-500 hover:text-stone-900 hover:bg-stone-100',
  }
  return (
    <button onClick={onClick} disabled={disabled}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition focus:outline-none disabled:opacity-40 ${styles[variant]} ${className}`}>
      {children}
    </button>
  )
}

const Card = ({ children, className = '' }) => (
  <div className={`bg-white border border-stone-200 rounded-xl ${className}`}>{children}</div>
)

const SectionHeader = ({ title, subtitle, action }) => (
  <div className="flex items-start justify-between mb-6">
    <div>
      <h2 className="text-xl font-bold text-stone-900" style={{fontFamily:"'Playfair Display', serif"}}>{title}</h2>
      {subtitle && <p className="text-sm text-stone-400 mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
)

const Spinner = () => (
  <div className="flex items-center justify-center py-20">
    <div className="w-6 h-6 border-2 border-stone-200 border-t-stone-900 rounded-full animate-spin"></div>
  </div>
)

// ══════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════
function Dashboard({ clientes, onSelect, onNew, loading }) {
  const total = clientes.reduce((s, c) => s + (Number(c.ingreso_mensual) || 0), 0)
  const count = r => clientes.filter(c => c.riesgo_final === r).length

  return (
    <div>
      <SectionHeader
        title="Panel de clientes"
        subtitle={`${clientes.length} cliente${clientes.length !== 1 ? 's' : ''} registrado${clientes.length !== 1 ? 's' : ''}`}
        action={<Btn onClick={onNew}>+ Nuevo cliente</Btn>}
      />

      <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4">
        {[
          { label: 'Ingreso mensual', value: fmt(total), accent: '' },
          { label: 'Riesgo Crítico',  value: count('Crítico'), accent: 'text-red-600' },
          { label: 'Riesgo Alto',     value: count('Alto'),    accent: 'text-orange-500' },
          { label: 'Sin auditar',     value: clientes.filter(c => !c.riesgo_final || c.riesgo_final === '—').length, accent: '' },
        ].map(k => (
          <Card key={k.label} className="p-4">
            <p className="text-xs text-stone-400 uppercase tracking-widest font-medium">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.accent || 'text-stone-900'}`}>{k.value}</p>
          </Card>
        ))}
      </div>

      {loading ? <Spinner /> : clientes.length === 0 ? (
        <Card className="p-16 text-center border-dashed">
          <p className="text-stone-400 text-sm">No hay clientes aún.</p>
          <Btn onClick={onNew} className="mt-4">Crear primer cliente</Btn>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  {['Cliente','Riesgo','Diagnóstico','Plan mensual','Ingreso','Responsable'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-stone-400 uppercase tracking-widest px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {clientes.map(c => (
                  <tr key={c.id} onClick={() => onSelect(c)}
                    className="cursor-pointer hover:bg-stone-50 transition">
                    <td className="px-4 py-3 font-semibold text-stone-900">{c.nombre}</td>
                    <td className="px-4 py-3"><Badge level={c.riesgo_final || '—'} /></td>
                    <td className="px-4 py-3 text-stone-500">{c.diagnostico_vendido ? fmt(c.diagnostico_vendido) : '—'}</td>
                    <td className="px-4 py-3 text-stone-500">{c.plan_mensual || '—'}</td>
                    <td className="px-4 py-3 font-medium text-stone-900">{c.ingreso_mensual ? fmt(c.ingreso_mensual) : '—'}</td>
                    <td className="px-4 py-3 text-stone-400">{c.responsable || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-stone-200 bg-stone-50">
                  <td colSpan={4} className="px-4 py-3 text-xs font-bold text-stone-500 uppercase tracking-widest">Total ingreso mensual</td>
                  <td className="px-4 py-3 font-bold text-stone-900">{fmt(total)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// CLIENTE FORM
// ══════════════════════════════════════════════════════════════
function ClienteForm({ cliente, onSave, onCancel, saving }) {
  const [f, setF] = useState({
    nombre: '', responsable: '', plan_mensual: '',
    ingreso_mensual: '', diagnostico_vendido: '', riesgo_final: '—',
    ...cliente
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Btn variant="ghost" onClick={onCancel} className="!px-2">←</Btn>
        <SectionHeader title={cliente ? 'Editar cliente' : 'Nuevo cliente'} />
      </div>
      <Card className="p-6 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { key: 'nombre', label: 'Nombre cliente *', placeholder: 'Empresa S.A.' },
            { key: 'responsable', label: 'Responsable', placeholder: 'Tu nombre' },
            { key: 'plan_mensual', label: 'Plan mensual', placeholder: 'Plan Continuidad' },
            { key: 'ingreso_mensual', label: 'Ingreso mensual (CLP)', placeholder: '380000', type: 'number' },
            { key: 'diagnostico_vendido', label: 'Diagnóstico vendido (CLP)', placeholder: '690000', type: 'number' },
          ].map(field => (
            <div key={field.key}>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-widest mb-1.5">{field.label}</label>
              <Input value={f[field.key]} onChange={v => set(field.key, v)} placeholder={field.placeholder} type={field.type} />
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-widest mb-1.5">Riesgo actual</label>
            <Select value={f.riesgo_final} onChange={v => set('riesgo_final', v)} options={['Crítico','Alto','Medio','Bajo','—']} />
          </div>
        </div>
        <div className="flex gap-3 pt-2 border-t border-stone-100">
          <Btn onClick={() => f.nombre && onSave(f)} disabled={!f.nombre || saving}>
            {saving ? 'Guardando...' : 'Guardar cliente'}
          </Btn>
          <Btn variant="outline" onClick={onCancel}>Cancelar</Btn>
        </div>
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// CLIENTE DETAIL
// ══════════════════════════════════════════════════════════════
function ClienteDetail({ cliente, auditData, cotData, onEdit, onAudit, onCot, onDelete, onBack }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Btn variant="ghost" onClick={onBack} className="!px-2">←</Btn>
          <div>
            <h2 className="text-xl font-bold text-stone-900" style={{fontFamily:"'Playfair Display', serif"}}>{cliente.nombre}</h2>
            <p className="text-sm text-stone-400">{cliente.responsable || 'Sin responsable asignado'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Btn variant="outline" onClick={onEdit}>Editar</Btn>
          <Btn variant="danger" onClick={onDelete}>Eliminar</Btn>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4">
        {[
          { label: 'Riesgo', value: <Badge level={cliente.riesgo_final || '—'} /> },
          { label: 'Plan mensual', value: cliente.plan_mensual || '—' },
          { label: 'Ingreso mensual', value: cliente.ingreso_mensual ? fmt(cliente.ingreso_mensual) : '—' },
          { label: 'Diagnóstico vendido', value: cliente.diagnostico_vendido ? fmt(cliente.diagnostico_vendido) : '—' },
        ].map(k => (
          <Card key={k.label} className="p-4">
            <p className="text-xs text-stone-400 uppercase tracking-widest font-medium mb-1">{k.label}</p>
            <div className="font-semibold text-stone-900 text-sm">{k.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
        {[
          {
            title: 'Revisión Preliminar',
            desc: 'Checklist técnico con cálculo automático de riesgo.',
            done: !!auditData,
            action: onAudit,
            label: auditData ? 'Ver / editar auditoría' : 'Iniciar auditoría',
          },
          {
            title: 'Cotización',
            desc: 'Calcula diagnóstico + plan mensual automáticamente.',
            done: !!cotData,
            action: onCot,
            label: cotData ? 'Ver / editar cotización' : 'Generar cotización',
          },
        ].map(m => (
          <Card key={m.title} className="p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-stone-900">{m.title}</h3>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${m.done ? 'bg-emerald-50 text-emerald-600' : 'bg-stone-100 text-stone-400'}`}>
                {m.done ? 'Completado' : 'Pendiente'}
              </span>
            </div>
            <p className="text-sm text-stone-400 mb-4">{m.desc}</p>
            <Btn variant="outline" onClick={m.action} className="w-full">{m.label}</Btn>
          </Card>
        ))}
      </div>

      {auditData && (
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-stone-500 uppercase tracking-widest">Resumen auditoría</h3>
            <Badge level={cliente.riesgo_final || '—'} />
          </div>
          <div className="divide-y divide-stone-50">
            {ALL_ITEMS.filter(label => auditData[label]?.valor).slice(0, 10).map(label => {
              const d = auditData[label]
              const risk = calcAutoRisk(label, d.valor) || d.riesgo_manual || ''
              return (
                <div key={label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-stone-600">{label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-stone-400 text-xs">{d.valor}</span>
                    {risk && <Badge level={risk} />}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// AUDITORIA
// ══════════════════════════════════════════════════════════════
function Auditoria({ cliente, auditData, onSave, onBack, saving }) {
  const init = {}
  ALL_ITEMS.forEach(label => { init[label] = { valor: '', obs: '', riesgo_manual: '' } })
  const [data, setData] = useState(auditData || init)

  const setField = (label, key, val) => setData(d => ({ ...d, [label]: { ...d[label], [key]: val } }))

  const itemsWithRisk = ALL_ITEMS.map(label => ({
    label,
    valor: data[label]?.valor || '',
    obs: data[label]?.obs || '',
    riesgo_manual: data[label]?.riesgo_manual || '',
    riesgo: calcAutoRisk(label, data[label]?.valor) || data[label]?.riesgo_manual || '',
  }))
  const finalRisk = calcFinalRisk(itemsWithRisk)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Btn variant="ghost" onClick={onBack} className="!px-2">←</Btn>
          <div>
            <h2 className="text-xl font-bold text-stone-900" style={{fontFamily:"'Playfair Display', serif"}}>Revisión Preliminar</h2>
            <p className="text-sm text-stone-400">{cliente.nombre}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-400">Resultado:</span>
          <Badge level={finalRisk} />
        </div>
      </div>

      <div className="space-y-4">
        {SECTIONS.map(section => (
          <Card key={section.cat} className="overflow-hidden">
            <div className="px-4 py-3 bg-stone-50 border-b border-stone-100">
              <h3 className="text-xs font-bold text-stone-500 uppercase tracking-widest">{section.cat}</h3>
            </div>
            <div className="divide-y divide-stone-50">
              {section.items.map(label => {
                const item = itemsWithRisk.find(i => i.label === label)
                const isAuto = AUTO_RISK_FIELDS.includes(label)
                return (
                  <div key={label} className="px-4 py-3 grid grid-cols-1 gap-2 sm:grid-cols-4 sm:gap-3 sm:items-center">
                    <div className="text-sm text-stone-700 font-medium sm:col-span-1">{label}</div>
                    <div className="sm:col-span-1">
                      <Input value={item.valor} onChange={v => setField(label, 'valor', v)}
                        placeholder={isAuto ? 'Ingresá el valor' : 'Valor...'} className="text-xs" />
                    </div>
                    <div className="sm:col-span-1">
                      {item.riesgo && isAuto
                        ? <Badge level={item.riesgo} />
                        : <Select value={item.riesgo_manual} onChange={v => setField(label, 'riesgo_manual', v)}
                            options={['Crítico','Alto','Medio','Bajo']} placeholder="Riesgo..." />
                      }
                    </div>
                    <div className="sm:col-span-1">
                      <Input value={item.obs} onChange={v => setField(label, 'obs', v)}
                        placeholder="Observación..." className="text-xs" />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        ))}
      </div>

      <div className="flex gap-3 mt-6">
        <Btn onClick={() => onSave(data, finalRisk)} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar auditoría'}
        </Btn>
        <Btn variant="outline" onClick={onBack}>Cancelar</Btn>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// COTIZACION
// ══════════════════════════════════════════════════════════════
function Cotizacion({ cliente, cotData, onSave, onBack, saving }) {
  const [v, setV] = useState({
    tamano: '', infraestructura: '', correos: '', ecommerce: '', productos: '',
    ...cotData
  })
  const set = (k, val) => setV(p => ({ ...p, [k]: val }))
  const { diag, plan, total } = calcCotizacion(v)

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Btn variant="ghost" onClick={onBack} className="!px-2">←</Btn>
        <div>
          <h2 className="text-xl font-bold text-stone-900" style={{fontFamily:"'Playfair Display', serif"}}>Cotización</h2>
          <p className="text-sm text-stone-400">{cliente.nombre}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Card className="p-5 space-y-4">
          <h3 className="text-xs font-bold text-stone-500 uppercase tracking-widest pb-2 border-b border-stone-100">Variables del cliente</h3>
          {[
            { key: 'tamano', label: 'Tamaño del sitio', placeholder: 'pequeño / mediano / grande' },
            { key: 'infraestructura', label: 'Infraestructura', opts: ['hosting compartido','VPS complejo'] },
            { key: 'correos', label: 'Correos críticos', opts: ['Sí','No'] },
            { key: 'ecommerce', label: '¿Es e-commerce?', opts: ['Sí','No'] },
            { key: 'productos', label: 'Cantidad de productos', placeholder: 'ej: 350', type: 'number' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-stone-500 mb-1.5">{f.label}</label>
              {f.opts
                ? <Select value={v[f.key]} onChange={val => set(f.key, val)} options={f.opts} />
                : <Input value={v[f.key]} onChange={val => set(f.key, val)} placeholder={f.placeholder} type={f.type} />
              }
            </div>
          ))}
        </Card>

        <div className="space-y-4">
          <Card className="p-5 space-y-2.5">
            <h3 className="text-xs font-bold text-stone-500 uppercase tracking-widest pb-2 border-b border-stone-100">Diagnóstico</h3>
            <div className="flex justify-between text-sm"><span className="text-stone-500">Base</span><span>$690.000</span></div>
            {v.infraestructura === 'VPS complejo' && <div className="flex justify-between text-sm text-orange-600"><span>+ VPS complejo</span><span>$200.000</span></div>}
            {v.correos === 'Sí' && <div className="flex justify-between text-sm text-orange-600"><span>+ Correos críticos</span><span>$150.000</span></div>}
            <div className="flex justify-between font-bold text-sm pt-2 border-t border-stone-100"><span>Subtotal diagnóstico</span><span>{fmt(diag)}</span></div>
          </Card>

          <Card className="p-5 space-y-2.5">
            <h3 className="text-xs font-bold text-stone-500 uppercase tracking-widest pb-2 border-b border-stone-100">Plan Mensual</h3>
            <div className="flex justify-between text-sm"><span className="text-stone-500">Base</span><span>$380.000</span></div>
            {v.ecommerce === 'Sí' && <div className="flex justify-between text-sm text-orange-600"><span>+ E-commerce</span><span>$120.000</span></div>}
            {Number(v.productos) > 500 && <div className="flex justify-between text-sm text-orange-600"><span>+ +500 productos</span><span>$100.000</span></div>}
            <div className="flex justify-between font-bold text-sm pt-2 border-t border-stone-100"><span>Subtotal mensual</span><span>{fmt(plan)}</span></div>
          </Card>

          <div className="bg-stone-900 text-white rounded-xl p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">Precio total recomendado</p>
            <p className="text-3xl font-bold mt-1" style={{fontFamily:"'Playfair Display', serif"}}>{fmt(total)}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <Btn onClick={() => onSave(v)} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cotización'}</Btn>
        <Btn variant="outline" onClick={onBack}>Cancelar</Btn>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// ROOT APP
// ══════════════════════════════════════════════════════════════
export default function App() {
  const [clientes, setClientes] = useState([])
  const [audits, setAudits]     = useState({})
  const [cots, setCots]         = useState({})
  const [view, setView]         = useState('dashboard')
  const [selected, setSelected] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)

  // ── Load data ──────────────────────────────────────────────
  useEffect(() => {
    loadClientes()
  }, [])

  async function loadClientes() {
    setLoading(true)
    const { data, error } = await supabase.from('clientes').select('*').order('created_at', { ascending: false })
    if (error) setError('Error al cargar clientes: ' + error.message)
    else setClientes(data || [])
    setLoading(false)
  }

  async function loadAudit(clienteId) {
    const { data } = await supabase.from('auditorias').select('*').eq('cliente_id', clienteId).single()
    if (data) setAudits(a => ({ ...a, [clienteId]: data.items }))
  }

  async function loadCot(clienteId) {
    const { data } = await supabase.from('cotizaciones').select('*').eq('cliente_id', clienteId).single()
    if (data) setCots(c => ({ ...c, [clienteId]: data.variables }))
  }

  const selectCliente = async (c) => {
    setSelected(c)
    if (!audits[c.id]) await loadAudit(c.id)
    if (!cots[c.id])   await loadCot(c.id)
    setView('detail')
  }

  // ── Save cliente ───────────────────────────────────────────
  async function handleSaveCliente(f) {
    setSaving(true)
    if (f.id) {
      const { data, error } = await supabase.from('clientes').update({
        nombre: f.nombre, responsable: f.responsable, plan_mensual: f.plan_mensual,
        ingreso_mensual: f.ingreso_mensual || null, diagnostico_vendido: f.diagnostico_vendido || null,
        riesgo_final: f.riesgo_final,
      }).eq('id', f.id).select().single()
      if (!error) { setClientes(cs => cs.map(c => c.id === f.id ? data : c)); setSelected(data) }
      else setError(error.message)
    } else {
      const { data, error } = await supabase.from('clientes').insert({
        nombre: f.nombre, responsable: f.responsable, plan_mensual: f.plan_mensual,
        ingreso_mensual: f.ingreso_mensual || null, diagnostico_vendido: f.diagnostico_vendido || null,
        riesgo_final: f.riesgo_final || '—',
      }).select().single()
      if (!error) { setClientes(cs => [data, ...cs]); setSelected(data) }
      else setError(error.message)
    }
    setSaving(false)
    setView('detail')
  }

  // ── Save auditoria ─────────────────────────────────────────
  async function handleSaveAudit(data, finalRisk) {
    setSaving(true)
    const exists = audits[selected.id]
    if (exists) {
      await supabase.from('auditorias').update({ items: data }).eq('cliente_id', selected.id)
    } else {
      await supabase.from('auditorias').insert({ cliente_id: selected.id, items: data })
    }
    await supabase.from('clientes').update({ riesgo_final: finalRisk }).eq('id', selected.id)
    const updated = { ...selected, riesgo_final: finalRisk }
    setAudits(a => ({ ...a, [selected.id]: data }))
    setClientes(cs => cs.map(c => c.id === selected.id ? updated : c))
    setSelected(updated)
    setSaving(false)
    setView('detail')
  }

  // ── Save cotizacion ────────────────────────────────────────
  async function handleSaveCot(data) {
    setSaving(true)
    const exists = cots[selected.id]
    if (exists) {
      await supabase.from('cotizaciones').update({ variables: data }).eq('cliente_id', selected.id)
    } else {
      await supabase.from('cotizaciones').insert({ cliente_id: selected.id, variables: data })
    }
    setCots(c => ({ ...c, [selected.id]: data }))
    setSaving(false)
    setView('detail')
  }

  // ── Delete cliente ─────────────────────────────────────────
  async function handleDelete() {
    if (!window.confirm(`¿Eliminar a ${selected.nombre}? Esta acción no se puede deshacer.`)) return
    await supabase.from('auditorias').delete().eq('cliente_id', selected.id)
    await supabase.from('cotizaciones').delete().eq('cliente_id', selected.id)
    await supabase.from('clientes').delete().eq('id', selected.id)
    setClientes(cs => cs.filter(c => c.id !== selected.id))
    setSelected(null)
    setView('dashboard')
  }

  return (
    <div className="min-h-screen bg-stone-50" style={{fontFamily:"'DM Sans', sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />

      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => setView('dashboard')}
            className="font-bold text-stone-900 hover:opacity-60 transition flex items-center gap-2"
            style={{fontFamily:"'Playfair Display', serif"}}>
            2B Digital
            <span className="text-stone-300 font-normal text-sm">/ Sistema Técnico</span>
          </button>
          {selected && view !== 'dashboard' && (
            <span className="text-xs bg-stone-100 text-stone-500 px-3 py-1 rounded-full font-medium">{selected.nombre}</span>
          )}
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700 flex items-center justify-between max-w-4xl mx-auto">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-4">✕</button>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 py-8 pb-24">
        {view === 'dashboard'   && <Dashboard clientes={clientes} onSelect={selectCliente} onNew={() => { setSelected(null); setView('newClient') }} loading={loading} />}
        {view === 'newClient'   && <ClienteForm onSave={handleSaveCliente} onCancel={() => setView('dashboard')} saving={saving} />}
        {view === 'editClient'  && <ClienteForm cliente={selected} onSave={handleSaveCliente} onCancel={() => setView('detail')} saving={saving} />}
        {view === 'detail'      && selected && <ClienteDetail cliente={selected} auditData={audits[selected.id]} cotData={cots[selected.id]} onEdit={() => setView('editClient')} onAudit={() => setView('audit')} onCot={() => setView('cotizacion')} onDelete={handleDelete} onBack={() => setView('dashboard')} />}
        {view === 'audit'       && selected && <Auditoria cliente={selected} auditData={audits[selected.id]} onSave={handleSaveAudit} onBack={() => setView('detail')} saving={saving} />}
        {view === 'cotizacion'  && selected && <Cotizacion cliente={selected} cotData={cots[selected.id]} onSave={handleSaveCot} onBack={() => setView('detail')} saving={saving} />}
      </main>
    </div>
  )
}
