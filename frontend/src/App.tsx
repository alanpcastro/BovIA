import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Animais from './pages/Animais'
import AnimalDetalhe from './pages/AnimalDetalhe'
import Lotes from './pages/Lotes'
import Pesagens from './pages/Pesagens'
import Saude from './pages/Saude'
import Reproducao from './pages/Reproducao'
import Movimentacoes from './pages/Movimentacoes'
import Relatorios from './pages/Relatorios'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
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
            <Route path="pesagens" element={<Pesagens />} />
            <Route path="saude" element={<Saude />} />
            <Route path="reproducao" element={<Reproducao />} />
            <Route path="movimentacoes" element={<Movimentacoes />} />
            <Route path="relatorios" element={<Relatorios />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
