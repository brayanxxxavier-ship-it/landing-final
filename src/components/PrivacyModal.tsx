import React from 'react';
import { X, ShieldCheck } from 'lucide-react';
import { Language } from '../types';
import { t } from '../i18n/translations';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose, lang }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[hsl(var(--background)/0.8)] backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl p-6 sm:p-8 my-8 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
          title="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        <header className="mb-6">
          <div className="inline-flex items-center gap-2 mb-2 font-mono text-xs font-semibold tracking-widest uppercase text-[hsl(var(--primary))]">
            <ShieldCheck className="w-4 h-4 text-[hsl(var(--primary))]" />
            <span>Legal</span>
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-[hsl(var(--foreground))]">
            {t('privacy.title', lang)}
          </h2>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            {t('privacy.lede', lang)}
          </p>
        </header>

        <div className="space-y-6 text-sm text-[hsl(var(--muted-foreground))] leading-relaxed divide-y divide-[hsl(var(--border))]">
          <section className="pt-4 first:pt-0">
            <h3 className="font-display font-semibold text-base text-[hsl(var(--foreground))] mb-2">
              1. Qué datos recogemos
            </h3>
            <p>
              En el formulario de preventa: nombre completo, correo electrónico, teléfono, edad, tipo y número de documento, unidades seleccionadas y mensaje voluntario. Para solicitudes PQRS: tipo de solicitud, asunto y descripción.
            </p>
          </section>

          <section className="pt-4">
            <h3 className="font-display font-semibold text-base text-[hsl(var(--foreground))] mb-2">
              2. Para qué los recogemos
            </h3>
            <p>
              Para gestionar y dar trazabilidad a tu preventa, coordinar asesoría personalizada con un especialista, verificar la disponibilidad de cupos y prevenir solicitudes automatizadas fraudulentas. No comercializamos ni cedemos bases de datos a terceros.
            </p>
          </section>

          <section className="pt-4">
            <h3 className="font-display font-semibold text-base text-[hsl(var(--foreground))] mb-2">
              3. Almacenamiento seguro y local
            </h3>
            <p>
              Por estrictos criterios de seguridad por diseño (Security by Design), los números de identificación personal nunca se almacenan en el almacenamiento local del navegador (localStorage/sessionStorage). Los borradores solo retienen datos básicos de contacto para comodidad de llenado y pueden eliminarse inmediatamente con el botón correspondiente.
            </p>
          </section>

          <section className="pt-4">
            <h3 className="font-display font-semibold text-base text-[hsl(var(--foreground))] mb-2">
              4. Ejercicio de derechos
            </h3>
            <p>
              Puedes solicitar la consulta, rectificación o supresión de tus datos de la lista de preventa comunicándote mediante el módulo PQRS con tu código de seguimiento institucional de 6 dígitos.
            </p>
          </section>
        </div>

        <div className="mt-8 pt-4 border-t border-[hsl(var(--border))] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-semibold text-xs uppercase tracking-wider"
          >
            {t('privacy.close', lang)}
          </button>
        </div>
      </div>
    </div>
  );
};
