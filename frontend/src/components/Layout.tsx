import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, LayoutDashboard, ShoppingCart, Package, Building2, Users, BarChart3, ClipboardList, Archive, PackageCheck, AlertTriangle, CalendarClock } from 'lucide-react';
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
        <div className="max-w-full mx-auto px-4">
          {/* Top bar: logo + user */}
          <div className="flex items-center justify-between h-14 border-b border-gray-100">
            <img src="/assets/valemilk-logo.png" alt="Vale Milk" className="h-10 w-auto" />
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
          {/* Navigation links */}
          <div className="flex items-center flex-wrap gap-1 py-1">
            <Link to="/" className="flex items-center space-x-1 px-3 py-1.5 rounded text-sm hover:bg-gray-100">
              <LayoutDashboard size={16} /><span>Dashboard</span>
            </Link>
            {user?.perfil !== PerfilEnum.RECEBIMENTO && user?.perfil !== PerfilEnum.FILIAL && (
              <>
                <Link to="/items" className="flex items-center space-x-1 px-3 py-1.5 rounded text-sm hover:bg-gray-100">
                  <Package size={16} /><span>Análise de Itens</span>
                </Link>
                <Link to="/historico-compras" className="flex items-center space-x-1 px-3 py-1.5 rounded text-sm hover:bg-gray-100">
                  <BarChart3 size={16} /><span>Hist. Compras</span>
                </Link>
                <Link to="/fornecedores" className="flex items-center space-x-1 px-3 py-1.5 rounded text-sm hover:bg-gray-100">
                  <Building2 size={16} /><span>Fornecedores</span>
                </Link>
                <Link to="/pedidos" className="flex items-center space-x-1 px-3 py-1.5 rounded text-sm hover:bg-gray-100">
                  <ShoppingCart size={16} /><span>Pedidos</span>
                </Link>
              </>
            )}
            {(user?.perfil === PerfilEnum.RECEBIMENTO || user?.perfil === PerfilEnum.ADMIN) && (
              <Link to="/inventario" className="flex items-center space-x-1 px-3 py-1.5 rounded text-sm hover:bg-gray-100">
                <ClipboardList size={16} /><span>Inventário</span>
              </Link>
            )}
            {(user?.perfil === PerfilEnum.RECEBIMENTO || user?.perfil === PerfilEnum.ADMIN) && (
              <Link to="/reposicao" className="flex items-center space-x-1 px-3 py-1.5 rounded text-sm hover:bg-gray-100">
                <PackageCheck size={16} /><span>Reposição</span>
              </Link>
            )}
            {(user?.perfil === PerfilEnum.FILIAL || user?.perfil === PerfilEnum.ADMIN) && (
              <>
                <Link to="/inventario-filial" className="flex items-center space-x-1 px-3 py-1.5 rounded text-sm hover:bg-gray-100">
                  <ClipboardList size={16} /><span>Inv. Filial</span>
                </Link>
                <Link to="/avaria" className="flex items-center space-x-1 px-3 py-1.5 rounded text-sm hover:bg-gray-100">
                  <AlertTriangle size={16} /><span>Avaria</span>
                </Link>
              </>
            )}
            <Link to="/central-inventario" className="flex items-center space-x-1 px-3 py-1.5 rounded text-sm hover:bg-gray-100">
              <Archive size={16} /><span>Central Inventário</span>
            </Link>
            <Link to="/central-avaria" className="flex items-center space-x-1 px-3 py-1.5 rounded text-sm hover:bg-gray-100">
              <AlertTriangle size={16} /><span>Central Avaria</span>
            </Link>
            <Link to="/central-reposicao" className="flex items-center space-x-1 px-3 py-1.5 rounded text-sm hover:bg-gray-100">
              <PackageCheck size={16} /><span>Central Reposição</span>
            </Link>
            {(user?.perfil === PerfilEnum.FILIAL || user?.perfil === PerfilEnum.ADMIN) && (
              <Link to="/estoque-vencimento" className="flex items-center space-x-1 px-3 py-1.5 rounded text-sm hover:bg-gray-100">
                <CalendarClock size={16} /><span>Est. Vencimento</span>
              </Link>
            )}
            <Link to="/central-estoque-vencimento" className="flex items-center space-x-1 px-3 py-1.5 rounded text-sm hover:bg-gray-100">
              <CalendarClock size={16} /><span>Central Est. Venc.</span>
            </Link>
            {user?.perfil === PerfilEnum.ADMIN && (
              <Link to="/usuarios" className="flex items-center space-x-1 px-3 py-1.5 rounded text-sm hover:bg-gray-100">
                <Users size={16} /><span>Usuários</span>
              </Link>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
