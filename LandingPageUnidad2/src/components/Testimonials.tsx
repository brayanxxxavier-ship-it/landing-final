import React, { useEffect, useRef } from 'react';
import { Language } from '../types';
import { t } from '../i18n/translations';

interface TestimonialsProps {
  lang: Language;
}

export const Testimonials: React.FC<TestimonialsProps> = ({ lang }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const testimonials = [
    {
      quote: t('testimonials.first.quote', lang),
      initials: 'DM',
      name: 'Daniela M.',
      role: t('testimonials.first.role', lang),
    },
    {
      quote: t('testimonials.second.quote', lang),
      initials: 'AR',
      name: 'Andrés R.',
      role: t('testimonials.second.role', lang),
    },
    {
      quote: t('testimonials.third.quote', lang),
      initials: 'LC',
      name: 'Laura C.',
      role: t('testimonials.third.role', lang),
    },
  ];

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
    <section className="section" id="testimonials" aria-labelledby="testimonials-title">
      <div className="container" ref={containerRef}>
        <header className="section__head">
          <p className="eyebrow">{t('testimonials.eyebrow', lang)}</p>
          <h2 className="section__title" id="testimonials-title">
            {t('testimonials.title', lang)}
          </h2>
          <p className="section__lede">{t('testimonials.lede', lang)}</p>
        </header>

        <ul className="grid grid--testimonials">
          {testimonials.map((item, index) => (
            <li key={index} className="animate-on-scroll" style={{ transitionDelay: `${index * 120}ms` }}>
              <figure className="testimonial">
                <blockquote className="testimonial__quote">
                  {item.quote}
                </blockquote>
                <figcaption className="testimonial__author">
                  <span className="testimonial__avatar" aria-hidden="true">{item.initials}</span>
                  <span>
                    <span className="testimonial__name">{item.name}</span>
                    <span className="testimonial__role">{item.role}</span>
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
