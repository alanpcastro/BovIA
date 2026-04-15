import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import logo from '../assets/logo.png'
import api from '../services/api'

export default function EsqueciSenha() {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      await api.post('/auth/solicitar-reset', { email })
      setEnviado(true)
    } catch {
      setErro('Erro ao enviar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--gray-50)',
      padding: 16,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: '#fff',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
        padding: '40px 36px',
      }}>
        <img src={logo} alt="BovIA" style={{ width: 64, marginBottom: 20, display: 'block' }} />

        {!enviado ? (
          <>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-900)', marginBottom: 4 }}>
              Esqueceu sua senha?
            </div>
            <div style={{ fontSize: 14, color: 'var(--gray-500)', marginBottom: 24, lineHeight: 1.5 }}>
              Digite seu e-mail e enviaremos um link para redefinir sua senha.
            </div>

            {erro && (
              <div className="alert alert-error" style={{ marginBottom: 16 }}>
                {erro}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input
                  className="form-input"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={loading}
                style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
              >
                {loading ? <><span className="spinner" /> Enviando...</> : 'Enviar link de recuperacao'}
              </button>
            </form>
          </>
        ) : (
          <>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✉️</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 8 }}>
                E-mail enviado!
              </div>
              <div style={{ fontSize: 14, color: 'var(--gray-500)', lineHeight: 1.6 }}>
                Se o e-mail <strong>{email}</strong> estiver cadastrado, voce recebera um link para redefinir sua senha. Verifique sua caixa de entrada e spam.
              </div>
            </div>
          </>
        )}

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--gray-500)' }}>
          <Link to="/login" style={{ color: 'var(--green-800)', fontWeight: 600 }}>
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  )
}
