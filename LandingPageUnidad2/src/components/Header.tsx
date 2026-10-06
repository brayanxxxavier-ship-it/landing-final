import React, { useState, useEffect } from 'react';
import { Language, Theme } from '../types';
import { t } from '../i18n/translations';
import { Lock } from 'lucide-react';

interface HeaderProps {
  lang: Language;
  theme: Theme;
  onLanguageChange: (lang: Language) => void;
  onThemeToggle: () => void;
  onOpenPqrs: () => void;
  onOpenPrivacy: () => void;
  onOpenAdmin: () => void;
  onPreorderClick: () => void;
  selectedCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  lang,
  theme,
  onLanguageChange,
  onThemeToggle,
  onOpenPqrs,
  onOpenAdmin,
  onPreorderClick,
  selectedCount,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <header className={`site-header ${isScrolled ? 'is-scrolled' : ''}`} id="site-header">
        <div className="container header__inner">
          <a className="brand" href="#hero" aria-label="Luxury Galaxy, ir al inicio">
            <img
              className="brand__mark"
              src="/assets/images/luxury-galaxy-logo.svg"
              width={36}
              height={36}
              alt="Luxury Galaxy Logo"
            />
            <span className="brand__text">
              <span className="brand__name">{t('brand.name', lang)}</span>
              <span className="brand__sub">{t('brand.subtitle', lang)}</span>
            </span>
          </a>

          <button
            className="nav-toggle"
            type="button"
            id="nav-toggle"
            aria-expanded={isNavOpen}
            aria-controls="primary-nav"
            aria-label={isNavOpen ? t('a11y.closeMenu', lang) : t('a11y.openMenu', lang)}
            onClick={() => setIsNavOpen(!isNavOpen)}
          >
            <span className="nav-toggle__bars" aria-hidden="true"></span>
          </button>

          <nav className={`nav ${isNavOpen ? 'is-open' : ''}`} id="primary-nav" aria-label={t('a11y.mainNav', lang)}>
            <ul className="nav__list">
              <li>
                <a className="nav__link" href="#catalogue" onClick={() => setIsNavOpen(false)}>
                  {t('nav.catalogue', lang)}
                  {selectedCount > 0 && ` (${selectedCount})`}
                </a>
              </li>
              <li>
                <a className="nav__link" href="#benefits" onClick={() => setIsNavOpen(false)}>
                  {t('nav.benefits', lang)}
                </a>
              </li>
              <li>
                <a className="nav__link" href="#process" onClick={() => setIsNavOpen(false)}>
                  {t('nav.process', lang)}
                </a>
              </li>
              <li>
                <a className="nav__link" href="#testimonials" onClick={() => setIsNavOpen(false)}>
                  {t('nav.testimonials', lang)}
                </a>
              </li>
              <li>
                <button
                  type="button"
                  className="nav__link"
                  onClick={() => {
                    setIsNavOpen(false);
                    onOpenPqrs();
                  }}
                  style={{ background: 'none', border: 0, padding: 0, font: 'inherit', cursor: 'pointer' }}
                >
                  {t('nav.pqrs', lang)}
                </button>
              </li>
            </ul>

            <div className="nav__tools">
              <div className="lang-switch" role="group" aria-label={t('a11y.languageSwitcher', lang)}>
                <button
                  className="lang-switch__btn"
                  type="button"
                  data-lang="es"
                  aria-pressed={lang === 'es'}
                  onClick={() => onLanguageChange('es')}
                >
                  ES
                </button>
                <button
                  className="lang-switch__btn"
                  type="button"
                  data-lang="en"
                  aria-pressed={lang === 'en'}
                  onClick={() => onLanguageChange('en')}
                >
                  EN
                </button>
              </div>

              <button
                className="theme-toggle"
                type="button"
                id="theme-toggle"
                aria-pressed={theme === 'light'}
                aria-label={theme === 'light' ? t('a11y.themeToDark', lang) : t('a11y.themeToLight', lang)}
                onClick={onThemeToggle}
              >
                <span className="theme-toggle__icon" aria-hidden="true"></span>
              </button>

              <button
                className="theme-toggle"
                type="button"
                id="admin-toggle"
                title="Panel de Administración"
                aria-label="Abrir panel administrativo"
                onClick={onOpenAdmin}
              >
                <Lock className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]" />
              </button>

              <button
                type="button"
                className="btn btn--primary btn--sm cursor-pointer shadow-glow"
                onClick={() => {
                  setIsNavOpen(false);
                  onPreorderClick();
                }}
              >
                {t('nav.preorder', lang)}
              </button>
            </div>
          </nav>
        </div>
      </header>

      {isNavOpen && (
        <button
          type="button"
          className="nav-scrim"
          aria-label={t('a11y.closeMenu', lang)}
          onClick={() => setIsNavOpen(false)}
        />
      )}
    </>
  );
};
