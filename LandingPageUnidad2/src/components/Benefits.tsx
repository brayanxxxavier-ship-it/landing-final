import React, { useEffect, useRef } from 'react';
import { Language } from '../types';
import { t } from '../i18n/translations';

interface BenefitsProps {
  lang: Language;
}

export const Benefits: React.FC<BenefitsProps> = ({ lang }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const cards = el.querySelectorAll('.animate-on-scroll');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="section" id="benefits" aria-labelledby="benefits-title">
      <div className="container" ref={containerRef}>
        <header className="section__head">
          <p className="eyebrow">{t('benefits.eyebrow', lang)}</p>
          <h2 className="section__title" id="benefits-title">
            {t('benefits.title', lang)}
          </h2>
          <p className="section__lede">
            {t('benefits.lede', lang)}
          </p>
        </header>

        <ul className="grid grid--benefits">
          <li className="benefit animate-on-scroll" style={{ transitionDelay: '0ms' }}>
            <span className="benefit__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5z"/>
              </svg>
            </span>
            <h3 className="benefit__title">{t('benefits.exclusivity.title', lang)}</h3>
            <p className="benefit__text">{t('benefits.exclusivity.text', lang)}</p>
          </li>

          <li className="benefit animate-on-scroll" style={{ transitionDelay: '100ms' }}>
            <span className="benefit__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16M4 12h16M4 18h10"/>
              </svg>
            </span>
            <h3 className="benefit__title">{t('benefits.curation.title', lang)}</h3>
            <p className="benefit__text">{t('benefits.curation.text', lang)}</p>
          </li>

          <li className="benefit animate-on-scroll" style={{ transitionDelay: '200ms' }}>
            <span className="benefit__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21s-7-4.5-7-10a7 7 0 1114 0c0 5.5-7 10-7 10z"/>
                <circle cx="12" cy="11" r="2.5"/>
              </svg>
            </span>
            <h3 className="benefit__title">{t('benefits.tailored.title', lang)}</h3>
            <p className="benefit__text">{t('benefits.tailored.text', lang)}</p>
          </li>

          <li className="benefit animate-on-scroll" style={{ transitionDelay: '300ms' }}>
            <span className="benefit__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v18M7 8h7a3 3 0 010 6H7"/>
              </svg>
            </span>
            <h3 className="benefit__title">{t('benefits.transparency.title', lang)}</h3>
            <p className="benefit__text">{t('benefits.transparency.text', lang)}</p>
          </li>

          <li className="benefit animate-on-scroll" style={{ transitionDelay: '400ms' }}>
            <span className="benefit__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H8l-5 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
            </span>
            <h3 className="benefit__title">{t('benefits.support.title', lang)}</h3>
            <p className="benefit__text">{t('benefits.support.text', lang)}</p>
          </li>
        </ul>
      </div>
    </section>
  );
};
