import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, LayoutDashboard, ShoppingCart, Package, Building2, Users, TrendingUp, ClipboardList } from 'lucide-react';
import { PerfilEnum } from '../types';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold text-blue-600">CIS</h1>
              <Link
                to="/"
                className="flex items-center space-x-2 px-3 py-2 rounded hover:bg-gray-100"
              >
                <LayoutDashboard size={20} />
                <span>Dashboard</span>
              </Link>
              <Link
                to="/items"
                className="flex items-center space-x-2 px-3 py-2 rounded hover:bg-gray-100"
              >
                <Package size={20} />
                <span>Análise de Itens</span>
              </Link>
              <Link
                to="/items/historical"
                className="flex items-center space-x-2 px-3 py-2 rounded hover:bg-gray-100"
              >
                <TrendingUp size={20} />
                <span>Análise Histórica</span>
              </Link>
              <Link
                to="/fornecedores"
                className="flex items-center space-x-2 px-3 py-2 rounded hover:bg-gray-100"
              >
                <Building2 size={20} />
                <span>Fornecedores</span>
              </Link>
              <Link
                to="/pedidos"
                className="flex items-center space-x-2 px-3 py-2 rounded hover:bg-gray-100"
              >
                <ShoppingCart size={20} />
                <span>Pedidos</span>
              </Link>
              {(user?.perfil === PerfilEnum.RECEBIMENTO || user?.perfil === PerfilEnum.ADMIN) && (
                <Link
                  to="/inventario"
                  className="flex items-center space-x-2 px-3 py-2 rounded hover:bg-gray-100"
                >
                  <ClipboardList size={20} />
                  <span>Inventário</span>
                </Link>
              )}
              {user?.perfil === PerfilEnum.ADMIN && (
                <Link
                  to="/usuarios"
                  className="flex items-center space-x-2 px-3 py-2 rounded hover:bg-gray-100"
                >
                  <Users size={20} />
                  <span>Usuários</span>
                </Link>
              )}
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium">{user?.nome}</p>
                <p className="text-xs text-gray-500">{user?.perfil}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-600 hover:text-red-600 hover:bg-gray-100 rounded"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
