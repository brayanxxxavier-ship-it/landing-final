import React, { useState, useEffect, useRef } from 'react';
import {
  X, Lock, BarChart3, Car, FileText, MessageSquare, Plus, Trash2, Edit2,
  AlertCircle, RefreshCw, LogOut, Eye, EyeOff, Upload, Image as ImageIcon,
  Mail, UserCheck, ShieldCheck, FileWarning, CheckCircle
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
const ALLOWED_IMAGE_MIMES = ['image/jpeg','image/jpg','image/png','image/webp','image/avif','image/svg+xml'];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, onClose, lang, onVehiclesUpdated }) => {
  const [token, setToken] = useState<string>(() => {
    try { return sessionStorage.getItem('lg-admin-token') || ''; } catch { return ''; }
  });
  const [adminUser, setAdminUser] = useState<any>(() => {
    try { const s = sessionStorage.getItem('lg-admin-user'); return s? JSON.parse(s) : null; } catch { return null; }
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  const [activeTab, setActiveTab] = useState<'stats'|'vehicles'|'preorders'|'pqrs'>('stats');
  const [statsData, setStatsData] = useState<any>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [preorders, setPreorders] = useState<any[]>([]);
  const [pqrsList, setPqrsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Partial<Vehicle> | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageInputMode, setImageInputMode] = useState<'file'|'url'>('file');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAuthenticated = Boolean(token);

  useEffect(() => { if (isOpen && isAuthenticated) loadData(); }, [isOpen, isAuthenticated, activeTab]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'stats') {
        const [{ data: vehs }, { data: pres }, { data: pqrs }] = await Promise.all([
          supabase.from('vehicles').select('id, name, internal_id'),
          supabase.from('preorders').select('selected_vehicle_ids'),
          supabase.from('pqrs').select('id')
        ]);
        const counts: Record<string, number> = {};
        pres?.forEach((p: any) => p.selected_vehicle_ids?.forEach((id: string) => counts[id] = (counts[id]||0)+1));
        const vehicleStats = (vehs||[]).map((v:any) => ({
          id: v.id, name: v.name, internal_code: v.internal_id, requestsCount: counts[v.id]||0
        }));
        setStatsData({ totalVehicles: vehs?.length||0, totalPreorders: pres?.length||0, totalPqrs: pqrs?.length||0, vehicleStats });
      }
      else if (activeTab === 'vehicles') {
        const { data, error } = await supabase.from('vehicles').select('*').order('display_order', { ascending: true });
        if (!error && data) {
          setVehicles(data.map((v:any,i:number) => ({
            id: v.id, internal_code: v.internal_id||`LG-EX-0${i+1}`, name: v.name, description: v.description,
            image_url: v.image_url||'', price_cop: Number(v.price_cop)||0, price_usd: Number(v.price_usd)||0,
            status: v.status==='agotado'?'sold':v.status==='preventa'?'reserved':'available', display_order: v.display_order??i+1, is_public: v.is_public??true
          })));
        }
      }
      else if (activeTab === 'preorders') {
        const { data } = await supabase.from('preorders').select('*').order('created_at', { ascending: false });
        setPreorders((data||[]).map((p:any)=>({ id:p.id, trackingCode:p.tracking_code, fullName:p.full_name, email:p.email, phone:p.phone, vehicleIds:p.selected_vehicle_ids, vehicleNames:p.selected_vehicle_ids, createdAt:p.created_at })));
      }
      else if (activeTab === 'pqrs') {
        const { data } = await supabase.from('pqrs').select('*').order('created_at', { ascending: false });
        setPqrsList((data||[]).map((q:any)=>({ id:q.id, trackingCode:q.tracking_code, requestType:q.type, fullName:q.full_name, email:q.email, phone:q.phone, subject:q.subject, message:q.message, status:q.status, createdAt:q.created_at })));
      }
    } catch (err) { console.error('[Admin] loadData', err); }
    finally { setIsLoading(false); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthError(''); setIsSubmittingAuth(true);
    try {
      const { data: sbData, error: sbError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (sbError ||!sbData.session) throw sbError || new Error('Sesión no creada');
      const { data: profile, error: profErr } = await supabase.from('admin_profiles').select('role, is_active').eq('user_id', sbData.user.id).maybeSingle();
      if (profErr ||!profile ||!profile.is_active ||!['admin','editor'].includes(profile.role)) {
        await supabase.auth.signOut(); throw new Error('Sin privilegios en admin_profiles');
      }
      setToken(sbData.session.access_token);
      const logged = { email: sbData.user.email, name: sbData.user.email?.split('@')[0], role: profile.role };
      setAdminUser(logged);
      sessionStorage.setItem('lg-admin-token', sbData.session.access_token);
      sessionStorage.setItem('lg-admin-user', JSON.stringify(logged));
      setPassword(''); loadData();
    } catch (err:any) { setAuthError('Acceso denegado: '+(err?.message||'Credenciales incorrectas')); }
    finally { setIsSubmittingAuth(false); }
  };

  const handleLogout = async () => {
    try { await supabase.auth.signOut(); } catch {}
    setToken(''); setAdminUser(null);
    sessionStorage.removeItem('lg-admin-token'); sessionStorage.removeItem('lg-admin-user');
  };

  const validateAndProcessFile = (file: File) => {
    setImageError(null);
    const lower = file.name.toLowerCase();
    const validExt = ALLOWED_IMAGE_EXTENSIONS.some(ext=>lower.endsWith(ext));
    const validMime = ALLOWED_IMAGE_MIMES.includes(file.type) || file.type.startsWith('image/');
    if (!validExt ||!validMime) { setImageError(`Formato no permitido (${file.name}). Solo.jpg.png.webp.avif.svg`); return; }
    if (file.size > 8*1024*1024) { setImageError('Máx 8 MB'); return; }
    const reader = new FileReader();
    reader.onload = e => { const r = e.target?.result as string; if(r) setEditingVehicle(p=>p?{...p, image_url:r}:null); };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if(e.target.files?.[0]) validateAndProcessFile(e.target.files[0]); if(fileInputRef.current) fileInputRef.current.value=''; };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if(e.dataTransfer.files?.[0]) validateAndProcessFile(e.dataTransfer.files[0]); };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault(); if(!editingVehicle) return;
    if(!editingVehicle.image_url) { setImageError('Debes anexar imagen'); return; }
    try {
      const isExisting = editingVehicle.id &&!editingVehicle.id.startsWith('new_');
      const dbPayload = {
        name: editingVehicle.name?.trim(), description: editingVehicle.description?.trim(),
        internal_id: editingVehicle.internal_code?.trim().toUpperCase(),
        price_cop: Number(editingVehicle.price_cop)||0, price_usd: Number(editingVehicle.price_usd)||0,
        status: editingVehicle.status==='available'?'consulta':editingVehicle.status==='reserved'?'preventa':'agotado',
        is_public: editingVehicle.is_public??true, image_url: editingVehicle.image_url,
        display_order: editingVehicle.display_order||vehicles.length+1, updated_at: new Date().toISOString()
      };
      if(isExisting){
        const { error } = await supabase.from('vehicles').update(dbPayload).eq('id', editingVehicle.id);
        if(error) throw error;
      } else {
        const { error } = await supabase.from('vehicles').insert({...dbPayload, created_at: new Date().toISOString() });
        if(error) throw error;
      }
      setIsVehicleModalOpen(false); setEditingVehicle(null); setImageError(null);
      loadData(); onVehiclesUpdated?.();
    } catch(err:any){ setImageError(err.message||'Error al guardar'); }
  };

  const handleDeleteVehicle = async (id: string) => {
    if(!window.confirm('¿Eliminar este vehículo?')) return;
    try { await supabase.from('vehicles').delete().eq('id', id); loadData(); onVehiclesUpdated?.(); } catch(err){ console.error(err); }
  };

  if(!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[hsl(var(--background)/0.88)] backdrop-blur-lg overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl p-5 sm:p-8 my-auto max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary)/0.15)] flex items-center justify-center text-[hsl(var(--primary))] border border-[hsl(var(--primary)/0.3)]"><Lock className="w-5 h-5" /></div>
            <div>
              <h2 className="font-display font-bold text-xl">Panel de Administración</h2>
              <p className="font-mono text-xs text-[hsl(var(--muted-foreground))] flex items-center gap-1.5">{isAuthenticated && adminUser? <><UserCheck className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />{adminUser.email}</> : 'Luxury Galaxy · Gestión de Catálogo'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAuthenticated && <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono cursor-pointer"><LogOut className="w-3.5 h-3.5" />Cerrar Sesión</button>}
            <button onClick={onClose} className="p-2 rounded-lg cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {!isAuthenticated? (
          <div className="my-auto py-8 max-w-md mx-auto w-full text-center">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.3)] items-center justify-center mb-4"><ShieldCheck className="w-7 h-7 text-[hsl(var(--primary))]" /></div>
            <h3 className="font-bold text-xl mb-2">Acceso Seguro a Dirección</h3>
            <form onSubmit={handleLogin} className="space-y-4 text-left font-mono text-xs">
              <div><label className="block mb-1.5">Correo / Usuario</label><div className="relative"><Mail className="absolute left-3 top-3 w-4 h-4 text-[hsl(var(--muted-foreground))]" /><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@luxurygalaxy.com" className="w-full pl-9 pr-3 py-2.5 rounded-lg border bg-[hsl(var(--input))]" required /></div></div>
              <div><label className="block mb-1.5">Contraseña</label><div className="relative"><Lock className="absolute left-3 top-3 w-4 h-4 text-[hsl(var(--muted-foreground))]" /><input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" className="w-full pl-9 pr-10 py-2.5 rounded-lg border bg-[hsl(var(--input))]" required /><button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute right-3 top-2.5 cursor-pointer">{showPassword?<EyeOff className="w-4 h-4" />:<Eye className="w-4 h-4" />}</button></div></div>
              {authError && <div className="flex gap-2 p-3 rounded-lg bg-red-500/15 border border-red-500/40 text-red-400"><AlertCircle className="w-4 h-4 shrink-0" /><span>{authError}</span></div>}
              <button type="submit" disabled={isSubmittingAuth} className="w-full btn btn--primary py-3 cursor-pointer">{isSubmittingAuth?'Autenticando...':'Iniciar Sesión'}</button>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex gap-2 border-b pb-3 mb-4 overflow-x-auto">
              {[
                {k:'stats', label:'Estadísticas', icon:BarChart3},
                {k:'vehicles', label:'Catálogo', icon:Car},
                {k:'preorders', label:'Preventas', icon:FileText},
                {k:'pqrs', label:'PQRS', icon:MessageSquare},
              ].map(t=>(
                <button key={t.k} onClick={()=>setActiveTab(t.k as any)} className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono uppercase cursor-pointer ${activeTab===t.k?'bg-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))] border border-[hsl(var(--primary)/0.5)]':'text-[hsl(var(--muted-foreground))]'}`}><t.icon className="w-4 h-4" />{t.label}</button>
              ))}
              <button onClick={loadData} className="ml-auto p-1.5 rounded-lg border cursor-pointer"><RefreshCw className={`w-4 h-4 ${isLoading?'animate-spin':''}`} /></button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {activeTab==='stats' && statsData && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl border"><span className="text-xs uppercase">Preventas</span><p className="text-3xl font-bold text-[hsl(var(--primary))]">{statsData.totalPreorders}</p></div>
                    <div className="p-4 rounded-xl border"><span className="text-xs uppercase">Flota</span><p className="text-3xl font-bold">{statsData.totalVehicles}</p></div>
                    <div className="p-4 rounded-xl border"><span className="text-xs uppercase">PQRS</span><p className="text-3xl font-bold">{statsData.totalPqrs}</p></div>
                  </div>
                  <div className="border rounded-xl p-5">
                    <h4 className="font-bold mb-4">Demanda por Vehículo</h4>
                    <div className="space-y-3">{statsData.vehicleStats.map((vs:any)=>{const max=Math.max(...statsData.vehicleStats.map((x:any)=>x.requestsCount),1); const pct=Math.round((vs.requestsCount/max)*100); return (<div key={vs.id}><div className="flex justify-between text-xs"><span>{vs.name} ({vs.internal_code})</span><span className="text-[hsl(var(--primary))] font-bold">{vs.requestsCount} solicitudes</span></div><div className="w-full h-2 bg-[hsl(var(--muted))] rounded-full"><div className="h-full bg-[hsl(var(--primary))] rounded-full" style={{width:`${Math.max(pct,4)}%`}} /></div></div>);})}</div>
                  </div>
                </div>
              )}

              {activeTab==='vehicles' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center"><p className="text-xs font-mono">Gestión del catálogo público</p><button onClick={()=>{ setEditingVehicle({ id:`new_${Date.now()}`, name:'', internal_code:`LG-EX-${String(vehicles.length+1).padStart(2,'0')}`, description:'', price_cop:4500000000, price_usd:1100000, status:'available', is_public:true, image_url:'', display_order:vehicles.length+1 }); setIsVehicleModalOpen(true); }} className="flex gap-1.5 btn btn--primary btn--sm cursor-pointer"><Plus className="w-3.5 h-3.5" />Añadir</button></div>
                  <div className="border rounded-xl overflow-x-auto"><table className="min-w-[620px] w-full text-xs font-mono"><thead className="bg-[hsl(var(--muted)/0.5)] border-b"><tr><th className="p-3">Foto</th><th className="p-3">Código</th><th className="p-3">Nombre</th><th className="p-3">Precio</th><th className="p-3">Estado</th><th className="p-3 text-right">Acciones</th></tr></thead><tbody className="divide-y">{vehicles.map(v=>(<tr key={v.id}><td className="p-3"><img src={v.image_url} alt={v.name} className="w-12 h-8 rounded object-cover border" /></td><td className="p-3 font-bold text-[hsl(var(--primary))]">{v.internal_code}</td><td className="p-3 font-semibold">{v.name}</td><td className="p-3">${(v.price_cop/1000000).toFixed(0)}M / ${(v.price_usd/1000).toFixed(0)}k</td><td className="p-3">{v.status}</td><td className="p-3 text-right"><button onClick={()=>{ setEditingVehicle({...v}); setIsVehicleModalOpen(true); }} className="p-1 cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button><button onClick={()=>handleDeleteVehicle(v.id)} className="p-1 text-red-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button></td></tr>))}</tbody></table></div>
                </div>
              )}

              {activeTab==='preorders' && <div className="border rounded-xl overflow-x-auto"><table className="w-full text-xs font-mono"><thead className="bg-[hsl(var(--muted)/0.5)] border-b"><tr><th className="p-3">Código</th><th className="p-3">Cliente</th><th className="p-3">Email</th><th className="p-3">Vehículos</th><th className="p-3">Fecha</th></tr></thead><tbody className="divide-y">{preorders.map(p=>(<tr key={p.id}><td className="p-3 font-bold text-[hsl(var(--primary))]">{p.trackingCode}</td><td className="p-3">{p.fullName}</td><td className="p-3">{p.email}</td><td className="p-3">{p.vehicleIds?.join(', ')}</td><td className="p-3">{new Date(p.createdAt).toLocaleDateString()}</td></tr>))}</tbody></table></div>}

              {activeTab==='pqrs' && <div className="border rounded-xl overflow-x-auto"><table className="w-full text-xs font-mono"><thead className="bg-[hsl(var(--muted)/0.5)] border-b"><tr><th className="p-3">Código</th><th className="p-3">Tipo</th><th className="p-3">Cliente</th><th className="p-3">Asunto</th><th className="p-3">Estado</th></tr></thead><tbody className="divide-y">{pqrsList.map(q=>(<tr key={q.id}><td className="p-3 font-bold text-[hsl(var(--primary))]">{q.trackingCode}</td><td className="p-3 uppercase">{q.requestType}</td><td className="p-3">{q.fullName}</td><td className="p-3">{q.subject}</td><td className="p-3">{q.status}</td></tr>))}</tbody></table></div>}
            </div>
          </div>
        )}

        {isVehicleModalOpen && editingVehicle && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-black/75 backdrop-blur-md overflow-y-auto">
            <div className="w-full max-w-xl bg-[hsl(var(--card))] border rounded-2xl p-6 shadow-2xl">
              <div className="flex justify-between mb-4 border-b pb-3"><h3 className="font-bold flex gap-2 items-center"><Car className="w-5 h-5 text-[hsl(var(--primary))]" />{editingVehicle.id?.startsWith('new_')?'Añadir Vehículo':'Editar Vehículo'}</h3><button onClick={()=>{ setIsVehicleModalOpen(false); setEditingVehicle(null); setImageError(null); }} className="cursor-pointer"><X className="w-4 h-4" /></button></div>
              <form onSubmit={handleSaveVehicle} className="space-y-3.5 font-mono text-xs">
                <div className="p-3.5 rounded-xl border bg-[hsl(var(--muted)/0.25)] space-y-2.5">
                  <div className="flex justify-between"><label className="font-semibold flex gap-1.5 items-center"><ImageIcon className="w-4 h-4 text-[hsl(var(--primary))]" />Fotografía</label><div className="flex gap-1 text-[11px]"><button type="button" onClick={()=>setImageInputMode('file')} className={`px-2 py-0.5 rounded cursor-pointer ${imageInputMode==='file'?'bg-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))] font-bold':''}`}>Archivo</button><button type="button" onClick={()=>setImageInputMode('url')} className={`px-2 py-0.5 rounded cursor-pointer ${imageInputMode==='url'?'bg-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))] font-bold':''}`}>URL</button></div></div>
                  {imageInputMode==='file' && <><input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.avif,.svg" onChange={handleFileChange} className="hidden" /><div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={()=>fileInputRef.current?.click()} className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer flex flex-col items-center gap-2 ${isDragging?'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)]':''}`}><Upload className="w-5 h-5" /><p>Haz clic o arrastra imagen (JPG/PNG/WEBP/SVG Máx 8MB)</p></div></>}
                  {imageInputMode==='url' && <input type="url" value={editingVehicle.image_url||''} onChange={e=>setEditingVehicle({...editingVehicle, image_url:e.target.value.trim()})} placeholder="https://..." className="w-full px-3 py-2 rounded-lg border bg-[hsl(var(--input))]" />}
                  {imageError && <div className="flex gap-2 p-2.5 rounded-lg bg-red-500/15 border border-red-500/40 text-red-400 text-[11px]"><FileWarning className="w-4 h-4" /><span>{imageError}</span></div>}
                  {editingVehicle.image_url &&!imageError && <div className="relative rounded-lg border overflow-hidden p-2 flex gap-3 items-center"><img src={editingVehicle.image_url} alt="preview" className="w-20 h-14 object-cover rounded border" /><div className="flex-1"><div className="flex gap-1 text-[hsl(var(--primary))] font-bold text-[11px]"><CheckCircle className="w-3.5 h-3.5" />Imagen cargada</div></div><button type="button" onClick={()=>setEditingVehicle({...editingVehicle, image_url:''})} className="text-[11px] text-red-500 cursor-pointer">Quitar</button></div>}
                </div>
                <div><label>Nombre Comercial</label><input type="text" required value={editingVehicle.name||''} onChange={e=>setEditingVehicle({...editingVehicle, name:e.target.value})} className="w-full px-3 py-2 rounded-lg border bg-[hsl(var(--input))]" /></div>
                <div className="grid grid-cols-2 gap-3"><div><label>Código Interno</label><input type="text" required value={editingVehicle.internal_code||''} onChange={e=>setEditingVehicle({...editingVehicle, internal_code:e.target.value})} className="w-full px-3 py-2 rounded-lg border bg-[hsl(var(--input))]" /></div><div><label>Estado</label><select value={editingVehicle.status||'available'} onChange={e=>setEditingVehicle({...editingVehicle, status:e.target.value as any})} className="w-full px-3 py-2 rounded-lg border bg-[hsl(var(--input))]"><option value="available">available</option><option value="reserved">reserved</option><option value="sold">sold</option></select></div></div>
                <div className="grid grid-cols-2 gap-3"><div><label>Precio COP</label><input type="number" required value={editingVehicle.price_cop||0} onChange={e=>setEditingVehicle({...editingVehicle, price_cop:Number(e.target.value)})} className="w-full px-3 py-2 rounded-lg border bg-[hsl(var(--input))]" /></div><div><label>Precio USD</label><input type="number" required value={editingVehicle.price_usd||0} onChange={e=>setEditingVehicle({...editingVehicle, price_usd:Number(e.target.value)})} className="w-full px-3 py-2 rounded-lg border bg-[hsl(var(--input))]" /></div></div>
                <div><label>Descripción</label><textarea rows={2} value={editingVehicle.description||''} onChange={e=>setEditingVehicle({...editingVehicle, description:e.target.value})} className="w-full px-3 py-2 rounded-lg border bg-[hsl(var(--input))]" /></div>
                <div className="flex items-center gap-2"><input type="checkbox" id="is_public_check" checked={editingVehicle.is_public??true} onChange={e=>setEditingVehicle({...editingVehicle, is_public:e.target.checked})} className="cursor-pointer" /><label htmlFor="is_public_check" className="cursor-pointer">Exhibir en catálogo público</label></div>
                <div className="flex justify-end gap-2 pt-3 border-t"><button type="button" onClick={()=>{ setIsVehicleModalOpen(false); setEditingVehicle(null); }} className="btn btn--ghost btn--sm cursor-pointer">Cancelar</button><button type="submit" className="btn btn--primary btn--sm cursor-pointer">Guardar Vehículo</button></div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};