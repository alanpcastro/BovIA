import { useState, FormEvent } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import logo from '../assets/logo.png'
import api from '../services/api'
import { apiErrorMessage } from '../utils/apiError'

export default function ResetSenha() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''

  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')

    if (senha.length < 6) {
      setErro('A senha deve ter no minimo 6 caracteres')
      return
    }
    if (senha !== confirmar) {
      setErro('As senhas nao coincidem')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/reset-senha', { token, nova_senha: senha })
      setSucesso(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err: any) {
      setErro(apiErrorMessage(err, 'Erro ao redefinir senha. O link pode ter expirado.'))
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--gray-50)',
        padding: 16,
      }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 8 }}>
            Link invalido
          </div>
          <div style={{ fontSize: 14, color: 'var(--gray-500)', marginBottom: 20 }}>
            Este link de recuperacao e invalido. Solicite um novo.
          </div>
          <Link to="/esqueci-senha" className="btn btn-primary">Solicitar novo link</Link>
        </div>
      </div>
    )
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

        {!sucesso ? (
          <>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-900)', marginBottom: 4 }}>
              Nova senha
            </div>
            <div style={{ fontSize: 14, color: 'var(--gray-500)', marginBottom: 24 }}>
              Digite sua nova senha abaixo.
            </div>

            {erro && (
              <div className="alert alert-error" style={{ marginBottom: 16 }}>
                {erro}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nova senha</label>
                <input
                  className="form-input"
                  type="password"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  required
                  placeholder="Minimo 6 caracteres"
                  autoFocus
                  minLength={6}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirmar senha</label>
                <input
                  className="form-input"
                  type="password"
                  value={confirmar}
                  onChange={e => setConfirmar(e.target.value)}
                  required
                  placeholder="Repita a senha"
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={loading}
                style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
              >
                {loading ? <><span className="spinner" /> Salvando...</> : 'Redefinir senha'}
              </button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--green-700)', marginBottom: 8 }}>
              Senha redefinida!
            </div>
            <div style={{ fontSize: 14, color: 'var(--gray-500)' }}>
              Voce sera redirecionado para o login em instantes...
            </div>
          </div>
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
