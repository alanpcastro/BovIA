import { useState, FormEvent } from 'react'
import farmBg from '../assets/farm_bg.png'
import logo from '../assets/logo.png'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

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
      setErro(err.response?.data?.detail || 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page" style={{ minHeight: '100vh', display: 'flex', background: '#111' }}>
      {/* Left hero */}
      <div className="auth-hero" style={{
        flex: 1,
        backgroundImage: `url(${farmBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: '40px',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
            Comece hoje mesmo
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', lineHeight: 1.2, maxWidth: 400 }}>
            Sua fazenda, sob controle total
          </div>
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', marginTop: 12, maxWidth: 360, lineHeight: 1.6 }}>
            Cadastro gratuito. Sem limite de animais. Dados seguros e isolados por fazenda.
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="auth-form-panel" style={{
        width: 460,
        flexShrink: 0,
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '48px',
      }}>
        <div style={{ marginBottom: 32 }}>
          <img src={logo} alt="BovIA" style={{ width: 80, marginBottom: 20, display: 'block' }} />
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gray-900)' }}>Criar nova conta</div>
          <div style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 4 }}>Preencha os dados para começar</div>
        </div>

        {erro && (
          <div className="alert alert-error">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 8v4m0 4h.01"/>
            </svg>
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid-2" style={{ gap: 12, marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Nome completo</label>
              <input className="form-input" value={nome} onChange={e => setNome(e.target.value)} required placeholder="João Silva" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Nome da fazenda</label>
              <input className="form-input" value={fazenda} onChange={e => setFazenda(e.target.value)} required placeholder="Fazenda Boa Vista" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">E-mail</label>
            <div className="input-wrapper">
              <span className="input-icon">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
              </span>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Senha</label>
            <div className="input-wrapper">
              <span className="input-icon">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path strokeLinecap="round" d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
              </span>
              <input className="form-input" type="password" value={senha} onChange={e => setSenha(e.target.value)} required placeholder="Mínimo 6 caracteres" minLength={6} />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
            style={{ width: '100%', marginTop: 4, justifyContent: 'center' }}
          >
            {loading ? <><span className="spinner" /> Criando conta...</> : 'Criar conta'}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--gray-500)' }}>
          Já tem conta?{' '}
          <Link to="/login" style={{ color: 'var(--green-800)', fontWeight: 600 }}>Entrar</Link>
        </div>
      </div>
    </div>
  )
}
