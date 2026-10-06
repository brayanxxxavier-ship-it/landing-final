import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Lock,
  Unlock,
  BarChart3,
  Car,
  FileText,
  MessageSquare,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  LogOut,
  Eye,
  EyeOff,
  Upload,
  Image as ImageIcon,
  Mail,
  UserCheck,
  ShieldCheck,
  FileWarning,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { Vehicle, Language } from '../types';
import { supabase } from '../lib/supabase';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onVehiclesUpdated?: () => void;
}

const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.svg'];
const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/svg+xml',
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  isOpen,
  onClose,
  lang,
  onVehiclesUpdated,
}) => {
  const [token, setToken] = useState<string>(() => {
    try {
      return sessionStorage.getItem('lg-admin-token') || '';
    } catch {
      return '';
    }
  });

  const [adminUser, setAdminUser] = useState<{ email: string; name?: string; role?: string } | null>(() => {
    try {
      const stored = sessionStorage.getItem('lg-admin-user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  // Tabs state
  const [activeTab, setActiveTab] = useState<'stats' | 'vehicles' | 'preorders' | 'pqrs'>('stats');
  const [statsData, setStatsData] = useState<any>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [preorders, setPreorders] = useState<any[]>([]);
  const [pqrsList, setPqrsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Vehicle editor modal state
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Partial<Vehicle> | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageInputMode, setImageInputMode] = useState<'file' | 'url'>('file');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAuthenticated = Boolean(token);

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      loadData();
    }
  }, [isOpen, isAuthenticated, activeTab]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      if (activeTab === 'stats') {
        const res = await fetch('/api/admin/stats', { headers });
        const json = await res.json();
        if (json.ok) setStatsData(json.stats);
      } else if (activeTab === 'vehicles') {
        const res = await fetch('/api/admin/vehicles', { headers });
        const json = await res.json();
        if (json.ok) setVehicles(json.data);
      } else if (activeTab === 'preorders') {
        const res = await fetch('/api/admin/preorders', { headers });
        const json = await res.json();
        if (json.ok) setPreorders(json.data);
      } else if (activeTab === 'pqrs') {
        const res = await fetch('/api/admin/pqrs', { headers });
        const json = await res.json();
        if (json.ok) setPqrsList(json.data);
      }
    } catch (err) {
      console.error('[Admin] Load data error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsSubmittingAuth(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password;

    if (!cleanEmail || !cleanPassword) {
      setAuthError('Por favor ingresa tanto el correo de usuario como la contraseña.');
      setIsSubmittingAuth(false);
      return;
    }

    try {
      // 1. Intentar autenticación con Supabase Auth si está configurado
      let supabaseToken = '';
      let supabaseEmail = '';

      try {
        const { data: sbData, error: sbError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });

        if (!sbError && sbData?.session) {
          supabaseToken = sbData.session.access_token;
          supabaseEmail = sbData.user?.email || cleanEmail;
        }
      } catch (err) {
        console.warn('[Admin Auth] Supabase client check notice:', err);
      }

      // 2. Enviar credenciales (y token de Supabase si se obtuvo) al backend para sesión segura
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPassword,
          supabaseToken,
        }),
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        setToken(data.token);
        const loggedUser = {
          email: supabaseEmail || data.user?.email || cleanEmail,
          name: data.user?.name || cleanEmail.split('@')[0],
          role: data.user?.role || 'admin',
        };
        setAdminUser(loggedUser);

        try {
          sessionStorage.setItem('lg-admin-token', data.token);
          sessionStorage.setItem('lg-admin-user', JSON.stringify(loggedUser));
        } catch {}

        setPassword('');
        loadData();
      } else {
        setAuthError(data.error || 'Credenciales inválidas. Verifica tu correo y contraseña.');
      }
    } catch {
      setAuthError('Error de conexión con el servidor. Inténtalo de nuevo.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    setToken('');
    setAdminUser(null);
    try {
      sessionStorage.removeItem('lg-admin-token');
      sessionStorage.removeItem('lg-admin-user');
    } catch {}
  };

  // Image validation & processing
  const validateAndProcessFile = (file: File) => {
    setImageError(null);
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const hasValidExt = ALLOWED_IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    const hasValidMime =
      ALLOWED_IMAGE_MIMES.includes(file.type) ||
      (file.type.startsWith('image/') && hasValidExt);

    if (!hasValidExt || !hasValidMime) {
      setImageError(
        `Formato no permitido ("${file.name}"). Únicamente se admiten archivos de imagen válidos: .jpg, .jpeg, .png, .webp, .avif o .svg. No se permiten archivos ejecutables ni extensiones no autorizadas.`
      );
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setImageError('El archivo excede el tamaño máximo permitido de 8 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setEditingVehicle((prev) => (prev ? { ...prev, image_url: result } : null));
        setImageError(null);
      }
    };
    reader.onerror = () => {
      setImageError('No se pudo leer el archivo de imagen seleccionado.');
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndProcessFile(file);
    }
    // Reset file input so user can re-select same file if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndProcessFile(file);
    }
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle) return;

    if (!editingVehicle.image_url || editingVehicle.image_url.trim().length === 0) {
      setImageError('Debes anexar una imagen válida para el vehículo antes de guardarlo.');
      return;
    }

    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      let res;
      if (editingVehicle.id && !editingVehicle.id.startsWith('new_')) {
        res = await fetch(`/api/admin/vehicles/${editingVehicle.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(editingVehicle),
        });
      } else {
        res = await fetch('/api/admin/vehicles', {
          method: 'POST',
          headers,
          body: JSON.stringify(editingVehicle),
        });
      }

      const json = await res.json();
      if (!res.ok || !json.ok) {
        setImageError(json.error || 'Error al guardar el vehículo en el catálogo.');
        return;
      }

      setIsVehicleModalOpen(false);
      setEditingVehicle(null);
      setImageError(null);
      loadData();
      onVehiclesUpdated?.();
    } catch (err) {
      console.error('[Admin] Save vehicle error:', err);
      setImageError('Error de red al intentar guardar el vehículo.');
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este vehículo del catálogo de preventas?')) return;
    try {
      await fetch(`/api/admin/vehicles/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      loadData();
      onVehiclesUpdated?.();
    } catch (err) {
      console.error('[Admin] Delete vehicle error:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[hsl(var(--background)/0.88)] backdrop-blur-lg overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl p-5 sm:p-8 my-auto max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary)/0.15)] flex items-center justify-center text-[hsl(var(--primary))] border border-[hsl(var(--primary)/0.3)] shadow-glow">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-xl sm:text-2xl text-[hsl(var(--foreground))]">
                  Panel de Administración
                </h2>
                {isAuthenticated && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))] border border-[hsl(var(--primary)/0.3)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))] animate-pulse" />
                    AUTENTICADO
                  </span>
                )}
              </div>
              <p className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
                {isAuthenticated && adminUser ? (
                  <span className="text-[hsl(var(--foreground))] font-medium flex items-center gap-1.5 mt-0.5">
                    <UserCheck className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                    {adminUser.email}
                  </span>
                ) : (
                  'Luxury Galaxy · Gestión de Catálogo y Estadísticas de Preventa'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(var(--border))] hover:border-[hsl(var(--destructive))] text-xs font-mono text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] transition-colors cursor-pointer"
                title="Cerrar sesión de administrador"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cerrar Sesión</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
              title="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* AUTH SCREEN IF NOT LOGGED IN */}
        {!isAuthenticated ? (
          <div className="my-auto py-8 max-w-md mx-auto w-full text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))] mb-4 shadow-glow">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h3 className="font-display font-bold text-xl text-[hsl(var(--foreground))] mb-2">
              Acceso Seguro a Dirección
            </h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mb-6 leading-relaxed">
              Ingresa tu usuario (correo electrónico) y contraseña para acceder al catálogo en vivo, métricas de demanda y solicitudes de preventa.
            </p>

            <form onSubmit={handleLogin} className="space-y-4 text-left font-mono text-xs">
              {/* Email / User Field */}
              <div>
                <label className="block text-[hsl(var(--muted-foreground))] mb-1.5 font-medium">
                  Correo Electrónico / Usuario
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[hsl(var(--muted-foreground))]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@luxurygalaxy.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))]"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-[hsl(var(--muted-foreground))] mb-1.5 font-medium">
                  Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[hsl(var(--muted-foreground))]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer"
                    title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error banner */}
              {authError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-[hsl(var(--destructive)/0.15)] border border-[hsl(var(--destructive)/0.4)] text-[hsl(var(--destructive))]">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmittingAuth}
                className="w-full btn btn--primary py-3 cursor-pointer shadow-glow font-mono text-xs uppercase tracking-wider mt-2"
              >
                {isSubmittingAuth ? 'Autenticando...' : 'Iniciar Sesión'}
              </button>

              <div className="p-3 rounded-lg bg-[hsl(var(--muted)/0.3)] border border-[hsl(var(--border))] text-[11px] text-[hsl(var(--muted-foreground))] space-y-1">
                <p className="flex items-center gap-1.5 font-semibold text-[hsl(var(--foreground))]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                  Autenticación Doble Capa
                </p>
                <p>
                  Compatible con usuarios creados en <strong>Supabase Auth</strong> o con credenciales maestras configuradas en el servidor (<code className="text-[hsl(var(--primary))]">admin@luxurygalaxy.com</code>).
                </p>
              </div>
            </form>
          </div>
        ) : (
          /* AUTHENTICATED ADMIN DASHBOARD */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Nav Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-[hsl(var(--border))] pb-3 mb-4">
              <button
                type="button"
                onClick={() => setActiveTab('stats')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium uppercase tracking-wider transition-colors cursor-pointer ${
                  activeTab === 'stats'
                    ? 'bg-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))] border border-[hsl(var(--primary)/0.5)]'
                    : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Estadísticas & Demanda</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('vehicles')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium uppercase tracking-wider transition-colors cursor-pointer ${
                  activeTab === 'vehicles'
                    ? 'bg-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))] border border-[hsl(var(--primary)/0.5)]'
                    : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                }`}
              >
                <Car className="w-4 h-4" />
                <span>Catálogo & Unidades</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('preorders')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium uppercase tracking-wider transition-colors cursor-pointer ${
                  activeTab === 'preorders'
                    ? 'bg-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))] border border-[hsl(var(--primary)/0.5)]'
                    : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Solicitudes de Preventa</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('pqrs')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium uppercase tracking-wider transition-colors cursor-pointer ${
                  activeTab === 'pqrs'
                    ? 'bg-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))] border border-[hsl(var(--primary)/0.5)]'
                    : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>PQRS Radicadas</span>
              </button>

              <button
                type="button"
                onClick={loadData}
                disabled={isLoading}
                className="ml-auto p-1.5 rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
                title="Actualizar datos"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[hsl(var(--primary))]' : ''}`} />
              </button>
            </div>

            {/* TAB CONTENT SCROLLER */}
            <div className="flex-1 overflow-y-auto pr-1">
              
              {/* TAB 1: STATS & DEMAND */}
              {activeTab === 'stats' && (
                <div className="space-y-6">
                  {/* Top Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                      <span className="text-xs font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                        Total Preventas Radicadas
                      </span>
                      <p className="font-display font-bold text-3xl text-[hsl(var(--primary))] mt-2">
                        {statsData ? statsData.totalPreorders : '...'}
                      </p>
                      <span className="text-[11px] font-mono text-[hsl(var(--muted-foreground))] mt-1 block">
                        Registros trazables con código único
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                      <span className="text-xs font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                        Flota en Catálogo
                      </span>
                      <p className="font-display font-bold text-3xl text-[hsl(var(--foreground))] mt-2">
                        {statsData ? statsData.totalVehicles : '...'}
                      </p>
                      <span className="text-[11px] font-mono text-[hsl(var(--muted-foreground))] mt-1 block">
                        Superdeportivos e hiperautos
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                      <span className="text-xs font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                        PQRS Registradas
                      </span>
                      <p className="font-display font-bold text-3xl text-[hsl(var(--foreground))] mt-2">
                        {statsData ? statsData.totalPqrs : '...'}
                      </p>
                      <span className="text-[11px] font-mono text-[hsl(var(--muted-foreground))] mt-1 block">
                        Peticiones, reclamos y sugerencias
                      </span>
                    </div>
                  </div>

                  {/* Demand distribution chart */}
                  <div className="border border-[hsl(var(--border))] rounded-xl p-5 bg-[hsl(var(--card))]">
                    <h4 className="font-display font-bold text-base text-[hsl(var(--foreground))] mb-1">
                      Distribución de Demanda por Vehículo
                    </h4>
                    <p className="text-xs font-mono text-[hsl(var(--muted-foreground))] mb-4">
                      Conteo en tiempo real de veces que cada unidad ha sido seleccionada en formularios de preventa
                    </p>

                    {statsData?.vehicleStats && statsData.vehicleStats.length > 0 ? (
                      <div className="space-y-3 font-mono text-xs">
                        {statsData.vehicleStats.map((vs: any) => {
                          const maxCount = Math.max(
                            ...statsData.vehicleStats.map((item: any) => item.requestsCount),
                            1
                          );
                          const pct = Math.round((vs.requestsCount / maxCount) * 100);

                          return (
                            <div key={vs.id} className="space-y-1">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-[hsl(var(--foreground))]">
                                  {vs.name}{' '}
                                  <span className="text-[hsl(var(--muted-foreground))] font-normal">
                                    ({vs.internal_code})
                                  </span>
                                </span>
                                <span className="text-[hsl(var(--primary))] font-bold">
                                  {vs.requestsCount} solicitud{vs.requestsCount === 1 ? '' : 'es'}
                                </span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                                <div
                                  className="h-full bg-[hsl(var(--primary))] rounded-full transition-all duration-500"
                                  style={{ width: `${Math.max(pct, 4)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs font-mono text-[hsl(var(--muted-foreground))] py-6 text-center">
                        Aún no hay suficientes datos de solicitudes para calcular la distribución.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: VEHICLES & CATALOGUE */}
              {activeTab === 'vehicles' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-mono text-[hsl(var(--muted-foreground))]">
                      Agrega o edita vehículos para el catálogo de preventas visible a los clientes.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setImageError(null);
                        setImageInputMode('file');
                        setEditingVehicle({
                          id: `new_${Date.now()}`,
                          name: '',
                          internal_code: `LG-EX-${String(vehicles.length + 1).padStart(2, '0')}`,
                          description: '',
                          price_cop: 4500000000,
                          price_usd: 1100000,
                          status: 'available',
                          is_public: true,
                          image_url: '',
                        });
                        setIsVehicleModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 btn btn--primary btn--sm cursor-pointer shadow-glow font-mono text-xs uppercase"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Añadir Vehículo</span>
                    </button>
                  </div>

                  <div className="border border-[hsl(var(--border))] rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-[hsl(var(--muted)/0.5)] border-b border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]">
                        <tr>
                          <th className="p-3">Foto</th>
                          <th className="p-3">Código</th>
                          <th className="p-3">Nombre Comercial</th>
                          <th className="p-3">Precio (COP / USD)</th>
                          <th className="p-3">Estado</th>
                          <th className="p-3">Público</th>
                          <th className="p-3 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[hsl(var(--border))]">
                        {vehicles.map((v) => (
                          <tr key={v.id} className="hover:bg-[hsl(var(--muted)/0.2)] transition-colors">
                            <td className="p-3">
                              <img
                                src={v.image_url}
                                alt={v.name}
                                className="w-12 h-8 rounded object-cover border border-[hsl(var(--border))]"
                              />
                            </td>
                            <td className="p-3 font-bold text-[hsl(var(--primary))]">{v.internal_code}</td>
                            <td className="p-3 font-semibold text-[hsl(var(--foreground))]">{v.name}</td>
                            <td className="p-3 text-[hsl(var(--muted-foreground))]">
                              ${(v.price_cop / 1000000).toFixed(0)}M COP / ${(v.price_usd / 1000).toFixed(0)}k USD
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                                  v.status === 'available'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : v.status === 'reserved'
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                }`}
                              >
                                {v.status}
                              </span>
                            </td>
                            <td className="p-3">
                              {v.is_public ? (
                                <span className="text-[hsl(var(--primary))] font-semibold">Sí</span>
                              ) : (
                                <span className="text-[hsl(var(--muted-foreground))]">No</span>
                              )}
                            </td>
                            <td className="p-3 text-right space-x-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setImageError(null);
                                  setImageInputMode(v.image_url?.startsWith('data:') ? 'file' : 'url');
                                  setEditingVehicle({ ...v });
                                  setIsVehicleModalOpen(true);
                                }}
                                className="p-1 rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
                                title="Editar vehículo"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteVehicle(v.id)}
                                className="p-1 rounded text-[hsl(var(--destructive))] hover:opacity-80 transition-opacity cursor-pointer"
                                title="Eliminar vehículo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: PREORDERS */}
              {activeTab === 'preorders' && (
                <div className="space-y-4">
                  <div className="border border-[hsl(var(--border))] rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-[hsl(var(--muted)/0.5)] border-b border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]">
                        <tr>
                          <th className="p-3">Código</th>
                          <th className="p-3">Cliente</th>
                          <th className="p-3">Email</th>
                          <th className="p-3">Teléfono</th>
                          <th className="p-3">Vehículos Solicitados</th>
                          <th className="p-3">Fecha</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[hsl(var(--border))]">
                        {preorders.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-[hsl(var(--muted-foreground))]">
                              No hay solicitudes de preventa registradas aún.
                            </td>
                          </tr>
                        ) : (
                          preorders.map((p) => (
                            <tr key={p.id} className="hover:bg-[hsl(var(--muted)/0.2)] transition-colors">
                              <td className="p-3 font-bold text-[hsl(var(--primary))]">{p.trackingCode}</td>
                              <td className="p-3 font-semibold text-[hsl(var(--foreground))]">{p.fullName}</td>
                              <td className="p-3 text-[hsl(var(--muted-foreground))]">{p.email}</td>
                              <td className="p-3 text-[hsl(var(--muted-foreground))]">{p.phone}</td>
                              <td className="p-3 text-[hsl(var(--foreground))]">
                                {Array.isArray(p.vehicleNames) && p.vehicleNames.length > 0
                                  ? p.vehicleNames.join(', ')
                                  : p.vehicleIds?.join(', ')}
                              </td>
                              <td className="p-3 text-[hsl(var(--muted-foreground))]">
                                {new Date(p.createdAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: PQRS */}
              {activeTab === 'pqrs' && (
                <div className="space-y-4">
                  <div className="border border-[hsl(var(--border))] rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-[hsl(var(--muted)/0.5)] border-b border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]">
                        <tr>
                          <th className="p-3">Código</th>
                          <th className="p-3">Tipo</th>
                          <th className="p-3">Cliente</th>
                          <th className="p-3">Asunto</th>
                          <th className="p-3">Mensaje</th>
                          <th className="p-3">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[hsl(var(--border))]">
                        {pqrsList.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-[hsl(var(--muted-foreground))]">
                              No hay solicitudes PQRS radicadas aún.
                            </td>
                          </tr>
                        ) : (
                          pqrsList.map((q) => (
                            <tr key={q.id} className="hover:bg-[hsl(var(--muted)/0.2)] transition-colors">
                              <td className="p-3 font-bold text-[hsl(var(--primary))]">{q.trackingCode}</td>
                              <td className="p-3 uppercase font-semibold text-[hsl(var(--foreground))]">{q.requestType}</td>
                              <td className="p-3 text-[hsl(var(--muted-foreground))]">{q.fullName} ({q.email})</td>
                              <td className="p-3 font-medium text-[hsl(var(--foreground))]">{q.subject}</td>
                              <td className="p-3 text-[hsl(var(--muted-foreground))] max-w-xs truncate">{q.message}</td>
                              <td className="p-3 text-[hsl(var(--primary))]">{q.status}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL EDIT / ADD VEHICLE */}
        {isVehicleModalOpen && editingVehicle && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md overflow-y-auto">
            <div className="relative w-full max-w-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-5 sm:p-6 shadow-2xl my-auto animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between mb-4 border-b border-[hsl(var(--border))] pb-3">
                <div className="flex items-center gap-2">
                  <Car className="w-5 h-5 text-[hsl(var(--primary))]" />
                  <h3 className="font-display font-bold text-lg text-[hsl(var(--foreground))]">
                    {editingVehicle.id?.startsWith('new_') ? 'Añadir Nuevo Vehículo' : 'Editar Vehículo del Catálogo'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsVehicleModalOpen(false);
                    setEditingVehicle(null);
                    setImageError(null);
                  }}
                  className="p-1 rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveVehicle} className="space-y-3.5 font-mono text-xs">
                
                {/* Image Attachment & Strict Format Validation */}
                <div className="p-3.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.25)] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[hsl(var(--foreground))] font-semibold flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-[hsl(var(--primary))]" />
                      <span>Fotografía del Vehículo</span>
                    </label>
                    
                    <div className="flex items-center gap-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setImageInputMode('file')}
                        className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                          imageInputMode === 'file'
                            ? 'bg-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))] font-bold'
                            : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                        }`}
                      >
                        Subir Archivo
                      </button>
                      <span className="text-[hsl(var(--border))]">|</span>
                      <button
                        type="button"
                        onClick={() => setImageInputMode('url')}
                        className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                          imageInputMode === 'url'
                            ? 'bg-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))] font-bold'
                            : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                        }`}
                      >
                        Enlace URL
                      </button>
                    </div>
                  </div>

                  {/* Mode 1: File Upload with Drag & Drop */}
                  {imageInputMode === 'file' && (
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.avif,.svg,image/jpeg,image/png,image/webp,image/avif,image/svg+xml"
                        onChange={handleFileChange}
                        className="hidden"
                        id="vehicle-image-upload"
                      />

                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-2 ${
                          isDragging
                            ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)]'
                            : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.6)] bg-[hsl(var(--card))]'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-[hsl(var(--primary))]">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-[hsl(var(--foreground))] text-xs">
                            Haz clic para examinar o arrastra la imagen aquí
                          </p>
                          <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
                            Formatos autorizados: <strong>JPG, JPEG, PNG, WEBP, AVIF, SVG</strong> (Máx. 8 MB)
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mode 2: Direct URL */}
                  {imageInputMode === 'url' && (
                    <div>
                      <input
                        type="url"
                        value={editingVehicle.image_url || ''}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          setImageError(null);
                          setEditingVehicle({ ...editingVehicle, image_url: val });
                        }}
                        placeholder="https://images.unsplash.com/photo-..."
                        className="w-full px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] text-[hsl(var(--foreground))]"
                      />
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
                        Ingresa una URL HTTPS que apunte a una imagen válida (.jpg, .png, .webp, .svg).
                      </p>
                    </div>
                  )}

                  {/* Image Error Alert */}
                  {imageError && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[hsl(var(--destructive)/0.15)] border border-[hsl(var(--destructive)/0.4)] text-[hsl(var(--destructive))] text-[11px]">
                      <FileWarning className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{imageError}</span>
                    </div>
                  )}

                  {/* Image Preview Banner */}
                  {editingVehicle.image_url && !imageError && (
                    <div className="relative rounded-lg border border-[hsl(var(--border))] overflow-hidden bg-black/40 p-2 flex items-center gap-3">
                      <img
                        src={editingVehicle.image_url}
                        alt="Vista previa de vehículo"
                        className="w-20 h-14 object-cover rounded-md border border-[hsl(var(--border))] shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 text-[hsl(var(--primary))] font-bold text-[11px]">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Imagen cargada correctamente</span>
                        </div>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
                          {editingVehicle.image_url.startsWith('data:')
                            ? 'Archivo codificado en Base64 seguro para catálogo'
                            : editingVehicle.image_url}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingVehicle({ ...editingVehicle, image_url: '' });
                          setImageError(null);
                        }}
                        className="btn btn--ghost btn--sm text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)] px-2 py-1 text-[11px] cursor-pointer"
                      >
                        Quitar
                      </button>
                    </div>
                  )}
                </div>

                {/* Name */}
                <div>
                  <label className="block text-[hsl(var(--muted-foreground))] mb-1">Nombre Comercial</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Koenigsegg Jesko Attack"
                    value={editingVehicle.name || ''}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] text-[hsl(var(--foreground))]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[hsl(var(--muted-foreground))] mb-1">Código Interno</label>
                    <input
                      type="text"
                      required
                      placeholder="LG-EX-07"
                      value={editingVehicle.internal_code || ''}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, internal_code: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] text-[hsl(var(--foreground))]"
                    />
                  </div>
                  <div>
                    <label className="block text-[hsl(var(--muted-foreground))] mb-1">Estado de Preventa</label>
                    <select
                      value={editingVehicle.status || 'available'}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, status: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] text-[hsl(var(--foreground))]"
                    >
                      <option value="available">available (Disponible para Preventa)</option>
                      <option value="reserved">reserved (En Consulta)</option>
                      <option value="sold">sold (Agotado)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[hsl(var(--muted-foreground))] mb-1">Precio COP ($)</label>
                    <input
                      type="number"
                      required
                      value={editingVehicle.price_cop || 0}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, price_cop: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] text-[hsl(var(--foreground))]"
                    />
                  </div>
                  <div>
                    <label className="block text-[hsl(var(--muted-foreground))] mb-1">Precio USD ($)</label>
                    <input
                      type="number"
                      required
                      value={editingVehicle.price_usd || 0}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, price_usd: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] text-[hsl(var(--foreground))]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[hsl(var(--muted-foreground))] mb-1">Descripción Breve</label>
                  <textarea
                    rows={2}
                    placeholder="Especificaciones clave, serie y motorización..."
                    value={editingVehicle.description || ''}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] text-[hsl(var(--foreground))]"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="is_public_check"
                    checked={editingVehicle.is_public ?? true}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, is_public: e.target.checked })}
                    className="rounded cursor-pointer"
                  />
                  <label htmlFor="is_public_check" className="text-[hsl(var(--foreground))] cursor-pointer">
                    Exhibir de inmediato en el catálogo público de preventas
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-[hsl(var(--border))]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsVehicleModalOpen(false);
                      setEditingVehicle(null);
                      setImageError(null);
                    }}
                    className="btn btn--ghost btn--sm cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn--primary btn--sm cursor-pointer shadow-glow font-mono uppercase">
                    Guardar Vehículo
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
