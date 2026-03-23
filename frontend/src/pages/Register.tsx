import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0fdf4' },
  card: { background: '#fff', borderRadius: 12, padding: 40, width: '100%', maxWidth: 420, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
  logo: { textAlign: 'center', marginBottom: 28 },
  title: { fontSize: 26, fontWeight: 700, color: '#2d6a4f' },
  sub: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 },
  input: { width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none' },
  group: { marginBottom: 14 },
  btn: { width: '100%', padding: '11px', background: '#2d6a4f', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 8 },
  error: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 },
  link: { textAlign: 'center', marginTop: 20, fontSize: 13, color: '#6b7280' },
}

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [fazenda, setFazenda] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      await register(nome, email, senha, fazenda)
      navigate('/dashboard')
    } catch (err: any) {
      setErro(err.response?.data?.detail || 'Erro ao cadastrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>
          <div style={s.title}>🐄 BovIA</div>
          <div style={s.sub}>Criar nova conta</div>
        </div>
        {erro && <div style={s.error}>{erro}</div>}
        <form onSubmit={handleSubmit}>
          <div style={s.group}>
            <label style={s.label}>Nome completo</label>
            <input style={s.input} value={nome} onChange={e => setNome(e.target.value)} required placeholder="João Silva" />
          </div>
          <div style={s.group}>
            <label style={s.label}>Nome da fazenda</label>
            <input style={s.input} value={fazenda} onChange={e => setFazenda(e.target.value)} required placeholder="Fazenda Boa Vista" />
          </div>
          <div style={s.group}>
            <label style={s.label}>Email</label>
            <input style={s.input} type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" />
          </div>
          <div style={s.group}>
            <label style={s.label}>Senha</label>
            <input style={s.input} type="password" value={senha} onChange={e => setSenha(e.target.value)} required placeholder="Mínimo 6 caracteres" minLength={6} />
          </div>
          <button style={s.btn} type="submit" disabled={loading}>{loading ? 'Cadastrando...' : 'Criar conta'}</button>
        </form>
        <div style={s.link}>
          Já tem conta? <Link to="/login" style={{ color: '#2d6a4f', fontWeight: 600 }}>Entrar</Link>
        </div>
      </div>
    </div>
  )
}
