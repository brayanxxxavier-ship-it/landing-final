import React from 'react';
import { Vehicle, Language } from '../types';
import { t } from '../i18n/translations';
import { AlertCircle, ArrowDown, Check } from 'lucide-react';

interface CatalogueProps {
  vehicles: Vehicle[];
  selectedVehicleIds: string[];
  onToggleSelect: (vehicleId: string) => void;
  onClearSelection: () => void;
  lang: Language;
  requireSelectionNotice?: boolean;
}

export const Catalogue: React.FC<CatalogueProps> = ({
  vehicles,
  selectedVehicleIds,
  onToggleSelect,
  onClearSelection,
  lang,
  requireSelectionNotice,
}) => {
  const formatCop = (val: number) => {
    return `COP ${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(val)}`;
  };

  const formatUsd = (val: number) => {
    return `USD ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(val)}`;
  };

  const selectedCount = selectedVehicleIds.length;

  return (
    <section className="section" id="catalogue" aria-labelledby="catalogue-title">
      <div className="container">
        <header className="section__head">
          <p className="eyebrow">{t('catalogue.eyebrow', lang)}</p>
          <h2 className="section__title" id="catalogue-title">
            {t('catalogue.title', lang)}
          </h2>
          <p className="section__lede">
            {t('catalogue.lede', lang)}
          </p>
        </header>

        {/* NOTICE IF USER CLICKED PREORDER BEFORE SELECTING A VEHICLE */}
        {requireSelectionNotice && selectedCount === 0 && (
          <div
            className="mb-6 p-4 rounded-xl border border-[hsl(var(--primary)/0.6)] bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--foreground))] shadow-[0_0_24px_hsl(var(--primary)/0.25)] flex items-center gap-3 animate-bounce"
            role="alert"
          >
            <AlertCircle className="w-5 h-5 text-[hsl(var(--primary))] shrink-0" />
            <div className="text-sm font-mono">
              <span className="font-bold text-[hsl(var(--primary))] uppercase">Paso previo requerido: </span>
              <span>Por favor selecciona al menos un vehículo del catálogo para activar tu formulario de preventa.</span>
            </div>
          </div>
        )}

        {selectedCount > 0 && (
          <div className="selection-bar flex items-center justify-between flex-wrap gap-3" id="selection-bar">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--primary))] animate-pulse" />
              <p className="selection-bar__text font-mono text-sm font-semibold" id="selection-summary">
                {t('catalogue.selectionCount', lang, { count: selectedCount })}
              </p>
              <button
                className="btn btn--ghost btn--sm cursor-pointer text-xs font-mono"
                type="button"
                id="selection-clear"
                onClick={onClearSelection}
              >
                {t('catalogue.clear', lang)}
              </button>
            </div>

            <a
              href="#preorder"
              className="btn btn--primary btn--sm flex items-center gap-1.5 shadow-glow cursor-pointer font-mono text-xs uppercase"
            >
              <span>Continuar a preventa ({selectedCount})</span>
              <ArrowDown className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        <ul className="grid grid--catalogue" id="catalogue-list" aria-labelledby="catalogue-title">
          {vehicles.map((vehicle) => {
            const isSelected = selectedVehicleIds.includes(vehicle.id);
            const isAvailable = vehicle.status === 'available';

            return (
              <li
                key={vehicle.id}
                role="checkbox"
                aria-checked={isSelected}
                tabIndex={isAvailable ? 0 : -1}
                className={`vehicle ${isSelected ? 'is-selected ring-2 ring-[hsl(var(--primary))]' : ''} ${!isAvailable ? 'is-unavailable opacity-75' : 'cursor-pointer'}`}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('.vehicle__picker')) return;
                  if (isAvailable) onToggleSelect(vehicle.id);
                }}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && isAvailable) {
                    e.preventDefault();
                    onToggleSelect(vehicle.id);
                  }
                }}
              >
                <div className="vehicle__media">
                  <img
                    src={vehicle.image_url}
                    alt={t('catalogue.imageAlt', lang, { name: vehicle.name })}
                    width={1200}
                    height={750}
                    loading="lazy"
                    decoding="async"
                  />
                </div>

                <span className={`badge badge--${vehicle.status} vehicle__badge`}>
                  {t(`catalogue.status.${vehicle.status}`, lang)}
                </span>

                <span className="vehicle__picker">
                  <input
                    type="checkbox"
                    id={`vehicle-${vehicle.id}`}
                    checked={isSelected}
                    disabled={!isAvailable}
                    aria-label={t('catalogue.select', lang, { name: vehicle.name })}
                    onChange={() => onToggleSelect(vehicle.id)}
                  />
                </span>

                <div className="vehicle__body">
                  <p className="vehicle__code">{vehicle.internal_code}</p>
                  <h3 className="vehicle__name">{vehicle.name}</h3>
                  <p className="vehicle__description">
                    {lang === 'en' && vehicle.description_en ? vehicle.description_en : vehicle.description}
                  </p>
                  <div className="vehicle__prices">
                    <span className="vehicle__price-cop">{formatCop(vehicle.price_cop)}</span>
                    <span className="vehicle__price-usd">{formatUsd(vehicle.price_usd)}</span>
                    <span className="vehicle__price-note">{t('catalogue.priceNote', lang)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};
