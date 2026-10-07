import React, { useState, useEffect, useCallback } from 'react';
import { Vehicle, Language, Theme } from './types';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Benefits } from './components/Benefits';
import { Catalogue } from './components/Catalogue';
import { Process } from './components/Process';
import { Testimonials } from './components/Testimonials';
import { PreorderForm } from './components/PreorderForm';
import { Footer } from './components/Footer';
import { PqrsModal } from './components/PqrsModal';
import { PrivacyModal } from './components/PrivacyModal';
import { AdminDashboard } from './components/AdminDashboard';
import { INITIAL_VEHICLES } from './data/vehicles';
import { supabase } from './lib/supabase';

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem('lg-theme');
      if (stored === 'light' || stored === 'dark') return stored;
      if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
    } catch {}
    return 'dark';
  });

  const [lang, setLang] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem('lg-language');
      if (stored === 'es' || stored === 'en') return stored;
      if (window.navigator?.language?.toLowerCase().startsWith('en')) return 'en';
    } catch {}
    return 'es';
  });

  const [vehicles, setVehicles] = useState<Vehicle[]>(INITIAL_VEHICLES);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [isPqrsOpen, setIsPqrsOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [requireSelectionNotice, setRequireSelectionNotice] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('lg-theme', theme); } catch {}
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
    try { localStorage.setItem('lg-language', lang); } catch {}
  }, [lang]);

  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#admin') setIsAdminOpen(true);
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // SOLO SUPABASE - sin /api
  const loadVehicles = useCallback(async () => {
    try {
      const { data, error } = await supabase
       .from('vehicles')
       .select('*')
       .eq('is_public', true)
       .order('display_order', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const mapped: Vehicle[] = data.map((v: any) => ({
          id: v.id,
          internal_code: v.internal_id || v.id,
          name: v.name,
          description: v.description,
          description_en: v.description_en || v.description,
          image_url: v.image_url || '',
          price_cop: Number(v.price_cop) || 0,
          price_usd: Number(v.price_usd) || 0,
          status: v.status === 'agotado'? 'sold' : v.status === 'preventa'? 'reserved' : 'available',
          display_order: v.display_order,
          is_public: v.is_public?? true,
        }));
        setVehicles(mapped);
      }
    } catch (err) {
      console.error('[App] Supabase vehicles error:', err);
      // Se queda con INITIAL_VEHICLES si falla
    }
  }, []);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark'? 'light' : 'dark'));
  }, []);

  const handleToggleSelectVehicle = useCallback((id: string) => {
    setSelectedVehicleIds((prev) =>
      prev.includes(id)? prev.filter((item) => item!== id) : [...prev, id]
    );
    setRequireSelectionNotice(false);
  }, []);

  const handleRemoveVehicle = useCallback((id: string) => {
    setSelectedVehicleIds((prev) => prev.filter((item) => item!== id));
  }, []);

  const handleClearSelection = useCallback(() => setSelectedVehicleIds([]), []);

  const handlePreorderClick = useCallback(() => {
    if (selectedVehicleIds.length === 0) {
      setRequireSelectionNotice(true);
      document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => setRequireSelectionNotice(false), 7000);
    } else {
      document.getElementById('preorder')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedVehicleIds.length]);

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <Header lang={lang} theme={theme} onLanguageChange={setLang} onThemeToggle={handleToggleTheme} onOpenPqrs={() => setIsPqrsOpen(true)} onOpenPrivacy={() => setIsPrivacyOpen(true)} onOpenAdmin={() => setIsAdminOpen(true)} onPreorderClick={handlePreorderClick} selectedCount={selectedVehicleIds.length} />
      <main id="main">
        <Hero lang={lang} theme={theme} publishedCount={vehicles.filter((v) => v.status!== 'sold').length} selectedCount={selectedVehicleIds.length} onPreorderClick={handlePreorderClick} />
        <Benefits lang={lang} />
        <Catalogue vehicles={vehicles} selectedVehicleIds={selectedVehicleIds} onToggleSelect={handleToggleSelectVehicle} onClearSelection={handleClearSelection} lang={lang} requireSelectionNotice={requireSelectionNotice} />
        <Process lang={lang} />
        <Testimonials lang={lang} />
        <PreorderForm vehicles={vehicles} selectedVehicleIds={selectedVehicleIds} onRemoveVehicle={handleRemoveVehicle} onClearSelection={handleClearSelection} lang={lang} />
      </main>
      <Footer lang={lang} onOpenPqrs={() => setIsPqrsOpen(true)} onOpenPrivacy={() => setIsPrivacyOpen(true)} onOpenAdmin={() => setIsAdminOpen(true)} />
      <PqrsModal isOpen={isPqrsOpen} onClose={() => setIsPqrsOpen(false)} lang={lang} />
      <PrivacyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} lang={lang} />
      <AdminDashboard isOpen={isAdminOpen} onClose={() => setIsAdminOpen(false)} lang={lang} onVehiclesUpdated={loadVehicles} />
    </div>
  );
}