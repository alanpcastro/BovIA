import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import EsqueciSenha from './pages/EsqueciSenha'
import ResetSenha from './pages/ResetSenha'
import Dashboard from './pages/Dashboard'
import Animais from './pages/Animais'
import AnimalDetalhe from './pages/AnimalDetalhe'
import Lotes from './pages/Lotes'
import Pastagens from './pages/Pastagens'
import Pesagens from './pages/Pesagens'
import Saude from './pages/Saude'
import Reproducao from './pages/Reproducao'
import Movimentacoes from './pages/Movimentacoes'
import Financeiro from './pages/Financeiro'
import CustosNutricionais from './pages/CustosNutricionais'
import DespesasFixas from './pages/DespesasFixas'
import Relatorios from './pages/Relatorios'
import Graficos from './pages/Graficos'
import Configuracoes from './pages/Configuracoes'
import Simulador from './pages/Simulador'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/esqueci-senha" element={<EsqueciSenha />} />
          <Route path="/reset-senha" element={<ResetSenha />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="animais" element={<Animais />} />
            <Route path="animais/:id" element={<AnimalDetalhe />} />
            <Route path="lotes" element={<Lotes />} />
            <Route path="pastagens" element={<Pastagens />} />
            <Route path="pesagens" element={<Pesagens />} />
            <Route path="saude" element={<Saude />} />
            <Route path="reproducao" element={<Reproducao />} />
            <Route path="movimentacoes" element={<Movimentacoes />} />
            <Route path="financeiro" element={<Financeiro />} />
            <Route path="custos-nutricionais" element={<CustosNutricionais />} />
            <Route path="despesas-fixas" element={<DespesasFixas />} />
            <Route path="graficos" element={<Graficos />} />
            <Route path="relatorios" element={<Relatorios />} />
            <Route path="simulador" element={<Simulador />} />
            <Route path="configuracoes" element={<Configuracoes />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
