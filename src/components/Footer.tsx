import React from 'react';
import { Language } from '../types';
import { t } from '../i18n/translations';

interface FooterProps {
  lang: Language;
  onOpenPqrs: () => void;
  onOpenPrivacy: () => void;
  onOpenAdmin: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  lang,
  onOpenPqrs,
  onOpenPrivacy,
  onOpenAdmin,
}) => {
  return (
    <footer className="site-footer" id="site-footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <img
            className="brand__mark"
            src="/assets/images/luxury-galaxy-logo.svg"
            width={36}
            height={36}
            alt="Luxury Galaxy Logo"
          />
          <p className="footer__name">
            {t('brand.name', lang)} <span>{t('brand.subtitle', lang)}</span>
          </p>
          <p className="footer__text">{t('footer.about', lang)}</p>
        </div>

        <nav className="footer__nav" aria-label={t('a11y.footerNav', lang)}>
          <h2 className="footer__heading">{t('footer.navHeading', lang)}</h2>
          <ul className="footer__list">
            <li><a href="#catalogue">{t('nav.catalogue', lang)}</a></li>
            <li><a href="#process">{t('nav.process', lang)}</a></li>
            <li><a href="#preorder">{t('nav.preorder', lang)}</a></li>
          </ul>
        </nav>

        <div className="footer__nav">
          <h2 className="footer__heading">{t('footer.legalHeading', lang)}</h2>
          <ul className="footer__list">
            <li>
              <button
                type="button"
                onClick={onOpenPrivacy}
                style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}
              >
                {t('footer.privacy', lang)}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={onOpenPqrs}
                style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}
              >
                {t('footer.pqrs', lang)}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={onOpenAdmin}
                style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}
              >
                Panel de Administración
              </button>
            </li>
          </ul>
          <p className="footer__text">
            <span>{t('footer.contactLabel', lang)} </span>
            <a href="mailto:contacto@luxury-galaxy.example">contacto@luxury-galaxy.example</a>
          </p>
          <p className="footer__placeholder">[Dirección y teléfono de preventas exclusivas · Bogotá, Colombia]</p>
        </div>
      </div>

      <div className="container footer__bottom">
        <p>{t('footer.copyright', lang)}</p>
        <p>
          <button
            type="button"
            onClick={onOpenPrivacy}
            style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }}
          >
            Privacidad
          </button>
          {' · '}
          <button
            type="button"
            onClick={onOpenPqrs}
            style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }}
          >
            PQRS
          </button>
          {' · '}
          <button
            type="button"
            onClick={onOpenAdmin}
            style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }}
          >
            Acceso Admin
          </button>
        </p>
      </div>
    </footer>
  );
};
