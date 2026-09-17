import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { Animal } from '../services/api'
import { useToast } from '../components/Toast'
import { formatKg } from '../utils/format'
import { todayLocal } from '../utils/date'
import { apiErrorMessage } from '../utils/apiError'

/** Uma leitura já feita nesta sessão de curral. */
type Leitura = {
  animal_id: number
  brinco: string
  peso_kg: number
  /** Peso da última pesagem conhecida, pra mostrar o ganho no ato. */
  peso_anterior?: number
}

type Sessao = {
  data: string
  leituras: Leitura[]
}

/** A sessão vive no aparelho até ser enviada com sucesso. No curral o app pode
 *  fechar, a tela apagar ou o sinal cair — nada disso pode perder o trabalho. */
const CHAVE_SESSAO = 'bovia:curral:sessao'

function carregarSessao(): Sessao {
  try {
    const bruto = localStorage.getItem(CHAVE_SESSAO)
    if (bruto) {
      const s = JSON.parse(bruto)
      if (s && Array.isArray(s.leituras) && typeof s.data === 'string') return s
    }
  } catch {
    // localStorage indisponível ou conteúdo corrompido: começa sessão nova
  }
  return { data: todayLocal(), leituras: [] }
}

export default function ModoCurral() {
  const navigate = useNavigate()
  const { success, error: toastError } = useToast()

  const [animais, setAnimais] = useState<Animal[]>([])
  const [carregandoAnimais, setCarregandoAnimais] = useState(true)
  const [sessao, setSessao] = useState<Sessao>(carregarSessao)
  const [brinco, setBrinco] = useState('')
  const [peso, setPeso] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [ultimoGanho, setUltimoGanho] = useState<string | null>(null)
  const [sexoNovo, setSexoNovo] = useState<'macho' | 'femea'>('femea')
  const [criandoAnimal, setCriandoAnimal] = useState(false)

  const brincoRef = useRef<HTMLInputElement>(null)
  const pesoRef = useRef<HTMLInputElement>(null)

  // Carrega TODOS os animais ativos (o backend limita a 200 por página, então pagina).
  // Precisa da lista inteira em memória: a busca do brinco é local, sem ida ao servidor.
  useEffect(() => {
    let cancelado = false
    async function carregar() {
      try {
        const encontrados: Animal[] = []
        let pagina = 1
        for (;;) {
          const r = await api.get('/animais', { params: { status: 'ativo', page: pagina, page_size: 200 } })
          encontrados.push(...r.data.items)
          if (encontrados.length >= r.data.total || r.data.items.length === 0) break
          pagina++
        }
        if (!cancelado) setAnimais(encontrados)
      } catch {
        if (!cancelado) toastError('Não foi possível carregar os animais')
      } finally {
        if (!cancelado) setCarregandoAnimais(false)
      }
    }
    carregar()
    return () => { cancelado = true }
  }, [])

  // Persiste a cada mudança — inclusive se o app for fechado no meio
  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao))
    } catch {
      // Sem localStorage a sessão só vive em memória; o envio continua funcionando
    }
  }, [sessao])

  const porBrinco = useMemo(() => {
    const m: Record<string, Animal> = {}
    animais.forEach(a => { if (a.brinco) m[a.brinco.toLowerCase()] = a })
    return m
  }, [animais])

  const jaPesados = useMemo(
    () => new Set(sessao.leituras.map(l => l.animal_id)),
    [sessao.leituras]
  )

  const busca = brinco.trim().toLowerCase()
  const animalExato = busca ? porBrinco[busca] : undefined
  // Sugestões por prefixo — ajuda quando o brinco está sujo ou meio apagado
  const sugestoes = useMemo(() => {
    if (!busca || animalExato) return []
    return animais
      .filter(a => a.brinco && a.brinco.toLowerCase().startsWith(busca))
      .slice(0, 4)
  }, [busca, animalExato, animais])

  const jaPesadoAgora = animalExato ? jaPesados.has(animalExato.id) : false

  function registrar() {
    setErro('')
    if (!animalExato) { setErro('Informe um brinco cadastrado'); return }
    const p = parseFloat(peso.replace(',', '.'))
    if (!isFinite(p) || p <= 0) { setErro('Informe o peso'); return }
    if (p > 3000) { setErro('Peso acima do limite (3000 kg)'); return }

    const anterior = animalExato.peso_atual ?? animalExato.peso_entrada

    setSessao(s => ({
      ...s,
      // Repesar o mesmo animal substitui a leitura anterior em vez de duplicar
      leituras: [
        ...s.leituras.filter(l => l.animal_id !== animalExato.id),
        { animal_id: animalExato.id, brinco: animalExato.brinco || String(animalExato.id), peso_kg: p, peso_anterior: anterior ?? undefined },
      ],
    }))

    // Feedback no ato: é o número que dá satisfação no curral
    if (anterior != null) {
      const g = p - anterior
      setUltimoGanho(`${animalExato.brinco ? `#${animalExato.brinco}` : 'Animal'}: ${g >= 0 ? '+' : ''}${formatKg(g)} desde a última pesagem`)
    } else {
      setUltimoGanho(`${animalExato.brinco ? `#${animalExato.brinco}` : 'Animal'}: primeira pesagem`)
    }

    setBrinco('')
    setPeso('')
    brincoRef.current?.focus()
  }

  /** Brinco não cadastrado: cria o animal ali mesmo, sem sair da tela. */
  async function criarEPesar() {
    const novoBrinco = brinco.trim()
    if (!novoBrinco) return
    const p = parseFloat(peso.replace(',', '.'))
    if (!isFinite(p) || p <= 0) { setErro('Informe o peso antes de cadastrar'); return }
    setCriandoAnimal(true)
    setErro('')
    try {
      const r = await api.post('/animais', {
        brinco: novoBrinco,
        sexo: sexoNovo,
        peso_entrada: p,
        data_entrada: sessao.data,
        origem: 'Cadastrado no curral',
      })
      const novo: Animal = r.data
      setAnimais(a => [...a, novo])
      setSessao(s => ({
        ...s,
        leituras: [...s.leituras, { animal_id: novo.id, brinco: novoBrinco, peso_kg: p }],
      }))
      setUltimoGanho(`#${novoBrinco}: cadastrado e pesado`)
      setBrinco('')
      setPeso('')
      brincoRef.current?.focus()
    } catch (err: any) {
      setErro(apiErrorMessage(err, 'Erro ao cadastrar animal'))
    } finally {
      setCriandoAnimal(false)
    }
  }

  function removerLeitura(animal_id: number) {
    setSessao(s => ({ ...s, leituras: s.leituras.filter(l => l.animal_id !== animal_id) }))
  }

  /** Recoloca a leitura nos campos pra corrigir — errar o peso e não conseguir
   *  voltar é das coisas mais frustrantes no campo. */
  function corrigirLeitura(l: Leitura) {
    setBrinco(l.brinco)
    setPeso(String(l.peso_kg).replace('.', ','))
    setSessao(s => ({ ...s, leituras: s.leituras.filter(x => x.animal_id !== l.animal_id) }))
    pesoRef.current?.focus()
  }

  async function concluir() {
    if (sessao.leituras.length === 0) return
    setEnviando(true)
    setErro('')
    try {
      const r = await api.post('/pesagens/lote', {
        data: sessao.data,
        itens: sessao.leituras.map(l => ({ animal_id: l.animal_id, peso_kg: l.peso_kg })),
      })
      const { criados, atualizados, peso_medio, gmd_medio } = r.data
      // Só limpa a sessão DEPOIS da confirmação do servidor
      setSessao({ data: todayLocal(), leituras: [] })
      try { localStorage.removeItem(CHAVE_SESSAO) } catch { /* nada a fazer */ }
      success(
        `${criados + atualizados} pesagem(ns) salva(s)` +
        (peso_medio != null ? ` · peso médio ${formatKg(peso_medio)}` : '') +
        (gmd_medio != null ? ` · GMD médio ${gmd_medio} kg/dia` : '')
      )
      navigate('/pesagens')
    } catch (err: any) {
      // A sessão continua no aparelho — dá pra tentar de novo quando voltar o sinal
      setErro(apiErrorMessage(err, 'Não foi possível enviar. Sua sessão foi mantida — tente de novo quando houver sinal.'))
    } finally {
      setEnviando(false)
    }
  }

  const pesoMedioSessao = sessao.leituras.length
    ? sessao.leituras.reduce((acc, l) => acc + l.peso_kg, 0) / sessao.leituras.length
    : null

  return (
    <div className="curral">
      <div className="curral-topo">
        <div>
          <div className="curral-titulo">Modo Curral</div>
          <div className="curral-sub">
            {carregandoAnimais
              ? 'Carregando rebanho...'
              : `${sessao.leituras.length} de ${animais.length} pesados`}
          </div>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate('/pesagens')}>Sair</button>
      </div>

      <div className="curral-entrada">
        <label className="form-label" htmlFor="curral-brinco">Brinco</label>
        <input
          id="curral-brinco"
          ref={brincoRef}
          className="form-input curral-campo"
          value={brinco}
          onChange={e => { setBrinco(e.target.value); setErro('') }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); pesoRef.current?.focus() } }}
          placeholder="Ex: A01"
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          enterKeyHint="next"
        />

        {/* O que o produtor precisa ver antes de anotar o peso */}
        {animalExato && (
          <div className={`curral-achado${jaPesadoAgora ? ' curral-achado-repetido' : ''}`}>
            <strong>#{animalExato.brinco}</strong>
            {animalExato.nome ? ` — ${animalExato.nome}` : ''}
            <div className="curral-achado-info">
              {animalExato.peso_atual != null
                ? `Último peso: ${formatKg(animalExato.peso_atual)}`
                : animalExato.peso_entrada != null
                  ? `Peso de entrada: ${formatKg(animalExato.peso_entrada)}`
                  : 'Sem peso anterior'}
              {jaPesadoAgora && ' · já pesado nesta sessão (vai substituir)'}
            </div>
          </div>
        )}

        {sugestoes.length > 0 && (
          <div className="curral-sugestoes">
            {sugestoes.map(a => (
              <button key={a.id} type="button" className="btn btn-outline btn-sm" onClick={() => setBrinco(a.brinco || '')}>
                #{a.brinco}
              </button>
            ))}
          </div>
        )}

        {busca && !animalExato && sugestoes.length === 0 && !carregandoAnimais && (
          <div className="curral-novo">
            <div>Brinco <strong>{brinco.trim()}</strong> não está cadastrado.</div>
            <div className="curral-novo-acoes">
              <select className="form-select" value={sexoNovo} onChange={e => setSexoNovo(e.target.value as 'macho' | 'femea')}>
                <option value="femea">Fêmea</option>
                <option value="macho">Macho</option>
              </select>
              <button type="button" className="btn btn-outline" onClick={criarEPesar} disabled={criandoAnimal}>
                {criandoAnimal ? 'Cadastrando...' : 'Cadastrar e pesar'}
              </button>
            </div>
          </div>
        )}

        <label className="form-label" htmlFor="curral-peso" style={{ marginTop: 16 }}>Peso (kg)</label>
        <input
          id="curral-peso"
          ref={pesoRef}
          className="form-input curral-campo curral-campo-peso"
          value={peso}
          onChange={e => { setPeso(e.target.value); setErro('') }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); registrar() } }}
          inputMode="decimal"
          placeholder="0"
          autoComplete="off"
          enterKeyHint="done"
        />

        {erro && <div className="form-error curral-erro">{erro}</div>}
        {!erro && ultimoGanho && <div className="curral-ganho">{ultimoGanho}</div>}
      </div>

      {sessao.leituras.length > 0 && (
        <div className="curral-lista">
          <div className="curral-lista-topo">
            <span>Pesados nesta sessão</span>
            {pesoMedioSessao != null && <span>Média {formatKg(pesoMedioSessao)}</span>}
          </div>
          {[...sessao.leituras].reverse().map(l => (
            <div key={l.animal_id} className="curral-item">
              <span className="curral-item-brinco">#{l.brinco}</span>
              <span className="curral-item-peso">{formatKg(l.peso_kg)}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => corrigirLeitura(l)}>Corrigir</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => removerLeitura(l.animal_id)} aria-label={`Remover ${l.brinco}`}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Barra fixa: a ação principal fica na zona do polegar */}
      <div className="curral-acoes">
        <button
          className="btn btn-primary curral-salvar"
          onClick={registrar}
          disabled={!animalExato || !peso}
        >
          Salvar e próximo
        </button>
        <button
          className="btn btn-outline curral-concluir"
          onClick={concluir}
          disabled={sessao.leituras.length === 0 || enviando}
        >
          {enviando ? 'Enviando...' : `Concluir (${sessao.leituras.length})`}
        </button>
      </div>
    </div>
  )
}
