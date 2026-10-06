import React, { useState, useEffect } from 'react';
import { Language, Theme } from '../types';
import { t } from '../i18n/translations';
import { AventadorParticle3D } from './AventadorParticle3D';
import { Sparkles, ShieldCheck, Clock } from 'lucide-react';

interface HeroProps {
  lang: Language;
  theme: Theme;
  publishedCount: number;
  selectedCount?: number;
  onPreorderClick?: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  lang,
  theme,
  publishedCount,
  onPreorderClick,
}) => {
  const fullTitle = t('hero.title', lang);
  const [displayedTitle, setDisplayedTitle] = useState<string>(() => {
    try {
      return sessionStorage.getItem('lg-typewriter-done') === 'true' ? fullTitle : '';
    } catch {
      return fullTitle;
    }
  });
  const [isTyping, setIsTyping] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('lg-typewriter-done') !== 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      if (sessionStorage.getItem('lg-typewriter-done') === 'true') {
        setDisplayedTitle(fullTitle);
        setIsTyping(false);
        return;
      }
    } catch {
      setDisplayedTitle(fullTitle);
      return;
    }

    let i = 0;
    setDisplayedTitle('');
    setIsTyping(true);

    const interval = setInterval(() => {
      i++;
      setDisplayedTitle(fullTitle.slice(0, i));
      if (i >= fullTitle.length) {
        clearInterval(interval);
        setIsTyping(false);
        try {
          sessionStorage.setItem('lg-typewriter-done', 'true');
        } catch {}
      }
    }, 38);

    return () => clearInterval(interval);
  }, [fullTitle]);

  return (
    <section className="hero overflow-hidden" id="hero" aria-labelledby="hero-title">
      <div className="container hero__inner flex flex-col items-center">
        {/* Top: Header, Title, Description & Action Buttons */}
        <div className="hero__copy text-center flex flex-col items-center max-w-4xl mx-auto w-full">
          <p className="eyebrow mx-auto justify-center">{t('hero.eyebrow', lang)}</p>
          
          <h1 className="hero__title text-center mx-auto min-h-[70px] sm:min-h-[85px] flex items-center justify-center flex-wrap" id="hero-title">
            <span>{displayedTitle}</span>
            {isTyping && (
              <span className="inline-block w-2 sm:w-2.5 h-7 sm:h-9 bg-[hsl(var(--primary))] ml-1 animate-pulse align-middle" />
            )}
          </h1>

          <p className="hero__subtitle text-center mx-auto max-w-2xl">
            {t('hero.subtitle', lang)}
          </p>
          <p className="hero__description text-center mx-auto max-w-2xl">
            {t('hero.description', lang)}
          </p>

          <div className="hero__actions flex flex-col sm:flex-row w-full sm:w-auto items-center justify-center gap-3 mx-auto mt-5 sm:mt-6">
            <button
              type="button"
              onClick={onPreorderClick}
              className="btn btn--primary w-full sm:w-auto px-6 sm:px-8 py-3 text-sm shadow-glow cursor-pointer"
            >
              {t('hero.cta', lang)}
            </button>
            <a className="btn btn--secondary w-full sm:w-auto px-6 sm:px-8 py-3 text-sm" href="#catalogue">
              {t('hero.ctaSecondary', lang)}
            </a>
          </div>
        </div>

        {/* Center: 3D Car Piece - Responsive height across mobile, tablet, desktop */}
        <div className="hero__car-showcase w-full max-w-5xl xl:max-w-6xl mx-auto my-4 sm:my-8 relative flex flex-col items-center">
          {/* Subtle Ambient Radial Glow backdrop */}
          <div
            className="absolute inset-0 pointer-events-none -z-10 opacity-70 blur-3xl"
            style={{
              background:
                theme === 'dark'
                  ? 'radial-gradient(ellipse 70% 55% at 50% 52%, hsl(var(--primary) / 0.16) 0%, transparent 75%)'
                  : 'radial-gradient(ellipse 70% 55% at 50% 52%, hsl(var(--primary) / 0.12) 0%, transparent 75%)',
            }}
            aria-hidden="true"
          />

          {/* Model Specification Pill */}
          <div className="mb-2 sm:mb-3 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card)/0.8)] backdrop-blur-md text-[hsl(var(--muted-foreground))] text-[10px] sm:text-xs font-mono tracking-wider uppercase shadow-xs max-w-full">
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--primary))] animate-pulse shrink-0" />
            <span className="truncate">Lamborghini Aventador SVJ · 770 CV · V12</span>
          </div>

          {/* 3D Canvas Container - Centered, proportional scale */}
          <div className="w-full h-[270px] xs:h-[330px] sm:h-[440px] md:h-[520px] lg:h-[600px] xl:h-[640px] relative rounded-xl sm:rounded-2xl overflow-hidden shadow-md border border-[hsl(var(--border)/0.7)] bg-[hsl(var(--card))]">
            <AventadorParticle3D theme={theme} lang={lang} />
          </div>

          {/* Helper hint */}
          <p className="mt-2 text-[10px] sm:text-xs font-mono text-[hsl(var(--muted-foreground))] text-center tracking-wide px-2">
            {lang === 'es'
              ? '✦ Toca dos veces o haz doble clic para activar la órbita 3D · El scroll permanece libre'
              : '✦ Double-tap or double-click to activate 3D orbit · Scroll remains free'}
          </p>
        </div>

        {/* Bottom: Hero Stats (Units, Published, Response Time) */}
        <dl className="hero__stats w-full max-w-3xl mx-auto grid grid-cols-3 gap-1.5 xs:gap-3 sm:gap-6 pt-3.5 sm:pt-6 border-t border-[hsl(var(--border))] text-center">
          <div className="stat flex flex-col items-center">
            <dt className="stat__label flex items-center justify-center gap-1 text-[10px] sm:text-xs">
              <Sparkles className="w-3 h-3 text-[hsl(var(--primary))] shrink-0" />
              <span>{t('hero.statUnits.label', lang)}</span>
            </dt>
            <dd className="stat__value text-lg xs:text-xl sm:text-3xl font-bold font-mono text-[hsl(var(--foreground))] mt-0.5">
              12
            </dd>
          </div>
          <div className="stat flex flex-col items-center">
            <dt className="stat__label flex items-center justify-center gap-1 text-[10px] sm:text-xs">
              <ShieldCheck className="w-3 h-3 text-[hsl(var(--primary))] shrink-0" />
              <span>{t('hero.statPublished.label', lang)}</span>
            </dt>
            <dd className="stat__value text-lg xs:text-xl sm:text-3xl font-bold font-mono text-[hsl(var(--primary))] mt-0.5">
              {publishedCount}
            </dd>
          </div>
          <div className="stat flex flex-col items-center">
            <dt className="stat__label flex items-center justify-center gap-1 text-[10px] sm:text-xs">
              <Clock className="w-3 h-3 text-[hsl(var(--primary))] shrink-0" />
              <span>{t('hero.statEmail.label', lang)}</span>
            </dt>
            <dd className="stat__value text-lg xs:text-xl sm:text-3xl font-bold font-mono text-[hsl(var(--foreground))] mt-0.5">
              {t('hero.statEmail.value', lang)}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
};
