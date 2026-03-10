import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PedidosPage from './pages/PedidosPage';
import PedidoDetailPage from './pages/PedidoDetailPage';
import ItemsAnalysisPage from './pages/ItemsAnalysisPage';
import HistoricoComprasPage from './pages/HistoricoComprasPage';
import CreatePedidoPage from './pages/CreatePedidoPage';
import FornecedoresPage from './pages/FornecedoresPage';
import UsersPage from './pages/UsersPage';
import InventarioPage from './pages/InventarioPage';
import CentralInventarioPage from './pages/CentralInventarioPage';
import ReposicaoPage from './pages/ReposicaoPage';
import Layout from './components/Layout';

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  }

  return user ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <DashboardPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pedidos"
        element={
          <ProtectedRoute>
            <Layout>
              <PedidosPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pedidos/novo"
        element={
          <ProtectedRoute>
            <Layout>
              <CreatePedidoPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pedidos/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <PedidoDetailPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/items"
        element={
          <ProtectedRoute>
            <Layout>
              <ItemsAnalysisPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/historico-compras"
        element={
          <ProtectedRoute>
            <Layout>
              <HistoricoComprasPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/fornecedores"
        element={
          <ProtectedRoute>
            <Layout>
              <FornecedoresPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/usuarios"
        element={
          <ProtectedRoute>
            <Layout>
              <UsersPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventario"
        element={
          <ProtectedRoute>
            <Layout>
              <InventarioPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/central-inventario"
        element={
          <ProtectedRoute>
            <Layout>
              <CentralInventarioPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reposicao"
        element={
          <ProtectedRoute>
            <Layout>
              <ReposicaoPage />
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
