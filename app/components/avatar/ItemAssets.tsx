'use client';

import { FC } from 'react';
import { ItemAssetKey } from './types';

// Cabeça
export function BoneBasico({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M32 8 C20 8 10 18 10 30 Q10 40 16 46 L16 52 Q16 56 20 56 H44 Q48 56 48 52 L48 46 Q54 40 54 30 C54 18 44 8 32 8 Z" fill="#3b82f6" stroke="#1e40af" strokeWidth="2"/>
      <path d="M16 30 Q22 26 32 26 Q42 26 48 30" fill="none" stroke="#1e40af" strokeWidth="1.5" strokeLinecap="round"/>
      <ellipse cx="32" cy="50" rx="12" ry="3" fill="#1e40af" opacity="0.3"/>
    </svg>
  );
}

export function BoneCivikoo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M32 8 C20 8 10 18 10 30 Q10 40 16 46 L16 52 Q16 56 20 56 H44 Q48 56 48 52 L48 46 Q54 40 54 30 C54 18 44 8 32 8 Z" fill="#f59e0b" stroke="#b45309" strokeWidth="2"/>
      <path d="M32 16 L32 28" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
      <path d="M24 22 L40 22" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="32" cy="22" r="8" fill="none" stroke="#fff" strokeWidth="2"/>
      <ellipse cx="32" cy="50" rx="12" ry="3" fill="#b45309" opacity="0.3"/>
    </svg>
  );
}

export function CapaceteObra({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 28 Q12 14 22 10 Q32 6 42 10 Q52 14 52 28 L52 38 Q52 44 46 48 L46 52 Q46 56 42 56 H22 Q18 56 18 52 L18 48 Q12 44 12 38 Z" fill="#fbbf24" stroke="#d97706" strokeWidth="2"/>
      <rect x="16" y="10" width="32" height="6" rx="2" fill="#f59e0b"/>
      <path d="M20 22 L44 22" stroke="#d97706" strokeWidth="1.5"/>
      <path d="M20 30 L44 30" stroke="#d97706" strokeWidth="1.5"/>
      <circle cx="32" cy="13" r="4" fill="#ef4444"/>
    </svg>
  );
}

export function ChapeuExplorador({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="32" cy="42" rx="24" ry="6" fill="#78716c" stroke="#44403c" strokeWidth="2"/>
      <path d="M8 42 Q8 20 20 14 Q32 8 44 14 Q56 20 56 42" fill="#8b5e3c" stroke="#5c3a1e" strokeWidth="2"/>
      <path d="M18 42 Q24 34 32 34 Q40 34 46 42" fill="none" stroke="#5c3a1e" strokeWidth="1.5"/>
      <path d="M16 42 L16 50 Q16 54 20 54 H44 Q48 54 48 50 L48 42" fill="#f59e0b" stroke="#b45309" strokeWidth="2"/>
      <ellipse cx="32" cy="50" rx="14" ry="3" fill="#5c3a1e" opacity="0.2"/>
    </svg>
  );
}

// Corpo
export function ColeteAmarelo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 80" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M14 10 L50 10 Q54 10 54 14 L54 66 Q54 70 50 70 H14 Q10 70 10 66 L10 14 Q10 10 14 10 Z" fill="#fde047" stroke="#ca8a04" strokeWidth="2"/>
      <rect x="14" y="10" width="36" height="60" fill="none" stroke="#ca8a04" strokeWidth="1" strokeDasharray="4,4"/>
      <path d="M18 20 L46 20 M18 30 L46 30 M18 40 L46 40 M18 50 L46 50 M18 60 L46 60" stroke="#ca8a04" strokeWidth="1" opacity="0.5"/>
      <rect x="20" y="16" width="24" height="8" rx="2" fill="#166534" opacity="0.9"/>
      <text x="32" y="22" fontSize="7" fill="#fff" textAnchor="middle" fontWeight="bold">CIVIKOO</text>
    </svg>
  );
}

export function ColeteLaranja({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 80" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M14 10 L50 10 Q54 10 54 14 L54 66 Q54 70 50 70 H14 Q10 70 10 66 L10 14 Q10 10 14 10 Z" fill="#fb923c" stroke="#ea580c" strokeWidth="2"/>
      <rect x="14" y="10" width="36" height="60" fill="none" stroke="#ea580c" strokeWidth="1" strokeDasharray="4,4"/>
      <rect x="16" y="14" width="32" height="4" fill="#fff" opacity="0.9"/>
      <rect x="16" y="28" width="32" height="4" fill="#fff" opacity="0.9"/>
      <rect x="16" y="42" width="32" height="4" fill="#fff" opacity="0.9"/>
      <rect x="16" y="56" width="32" height="4" fill="#fff" opacity="0.9"/>
      <path d="M22 20 L42 20 M22 34 L42 34 M22 48 L42 48 M22 62 L42 62" stroke="#ea580c" strokeWidth="1" opacity="0.3"/>
    </svg>
  );
}

export function JaquetaJeans({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 80" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M14 10 L50 10 Q54 10 54 14 L54 66 Q54 70 50 70 H14 Q10 70 10 66 L10 14 Q10 10 14 10 Z" fill="#1e3a5f" stroke="#1e3a5f" strokeWidth="2"/>
      <path d="M14 14 L50 14 M14 22 L50 22 M14 30 L50 30 M14 38 L50 38 M14 46 L50 46 M14 54 L50 54 M14 62 L50 62" stroke="#3b82f6" strokeWidth="1" opacity="0.4"/>
      <path d="M32 14 L32 66" stroke="#3b82f6" strokeWidth="2" strokeDasharray="6,4"/>
      <circle cx="20" cy="18" r="3" fill="#3b82f6"/>
      <circle cx="44" cy="18" r="3" fill="#3b82f6"/>
      <circle cx="20" cy="58" r="3" fill="#3b82f6"/>
      <circle cx="44" cy="58" r="3" fill="#3b82f6"/>
      <path d="M14 66 L50 66" stroke="#1e3a5f" strokeWidth="4" strokeLinecap="round"/>
    </svg>
  );
}

export function CasacoPremium({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 80" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M14 10 L50 10 Q54 10 54 14 L54 66 Q54 70 50 70 H14 Q10 70 10 66 L10 14 Q10 10 14 10 Z" fill="#0f172a" stroke="#1e293b" strokeWidth="2"/>
      <path d="M32 14 Q32 8 40 8 Q48 8 48 14" fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round"/>
      <path d="M32 14 Q32 8 24 8 Q16 8 16 14" fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round"/>
      <ellipse cx="32" cy="20" rx="18" ry="8" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4,4"/>
      <path d="M18 20 L24 20 M40 20 L46 20" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"/>
      <path d="M18 58 L46 58" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeDasharray="4,2"/>
      <circle cx="32" cy="35" r="6" fill="none" stroke="#f59e0b" strokeWidth="2"/>
      <text x="32" y="37" fontSize="6" fill="#f59e0b" textAnchor="middle" fontWeight="bold">★</text>
    </svg>
  );
}

// Acessórios
export function OculosSol({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 32" className={className} xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="20" cy="16" rx="12" ry="10" fill="#1e1e1e" stroke="#000" strokeWidth="2" opacity="0.9"/>
      <ellipse cx="44" cy="16" rx="12" ry="10" fill="#1e1e1e" stroke="#000" strokeWidth="2" opacity="0.9"/>
      <path d="M32 16 L32 16" stroke="#333" strokeWidth="3"/>
      <path d="M8 16 L8 16 M56 16 L56 16" stroke="#333" strokeWidth="3"/>
      <ellipse cx="20" cy="14" rx="6" ry="5" fill="#fff" opacity="0.15"/>
      <ellipse cx="44" cy="14" rx="6" ry="5" fill="#fff" opacity="0.15"/>
    </svg>
  );
}

export function OculosAviador({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 32" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M10 10 Q10 4 16 4 Q22 4 22 10 L22 22 Q22 28 16 28 Q10 28 10 22 Z" fill="#1e1e1e" stroke="#b45309" strokeWidth="2"/>
      <path d="M42 10 Q42 4 48 4 Q54 4 54 10 L54 22 Q54 28 48 28 Q42 28 42 22 Z" fill="#1e1e1e" stroke="#b45309" strokeWidth="2"/>
      <path d="M22 14 L42 14 M22 18 L42 18" stroke="#b45309" strokeWidth="2"/>
      <path d="M8 16 L10 16 M54 16 L56 16" stroke="#b45309" strokeWidth="3" strokeLinecap="round"/>
      <ellipse cx="16" cy="14" rx="5" ry="4" fill="#fbbf24" opacity="0.3"/>
      <ellipse cx="48" cy="14" rx="5" ry="4" fill="#fbbf24" opacity="0.3"/>
    </svg>
  );
}

export function RelogioDigital({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 40" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="4" width="20" height="24" rx="4" fill="#1e1e1e" stroke="#333" strokeWidth="2"/>
      <rect x="8" y="8" width="16" height="16" rx="2" fill="#0f172a"/>
      <text x="16" y="20" fontSize="9" fill="#22c55e" textAnchor="middle" fontFamily="monospace" fontWeight="bold">12:34</text>
      <rect x="14" y="28" width="4" height="8" rx="1" fill="#333"/>
      <path d="M6 14 L4 14 M6 20 L4 20 M28 14 L30 14 M28 20 L30 20" stroke="#333" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

export function FoneOversized({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 50" className={className} xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="16" cy="25" rx="12" ry="16" fill="#1e1e1e" stroke="#333" strokeWidth="2"/>
      <ellipse cx="48" cy="25" rx="12" ry="16" fill="#1e1e1e" stroke="#333" strokeWidth="2"/>
      <ellipse cx="16" cy="25" rx="7" ry="10" fill="#0f172a"/>
      <ellipse cx="48" cy="25" rx="7" ry="10" fill="#0f172a"/>
      <path d="M16 9 Q32 2 32 25 Q32 48 16 41" fill="none" stroke="#333" strokeWidth="4" strokeLinecap="round"/>
      <path d="M48 9 Q32 2 32 25 Q32 48 48 41" fill="none" stroke="#333" strokeWidth="4" strokeLinecap="round"/>
      <circle cx="16" cy="25" r="4" fill="#f59e0b"/>
      <circle cx="48" cy="25" r="4" fill="#f59e0b"/>
    </svg>
  );
}

// Fundos
export function FundoCidade({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fef3c7"/>
          <stop offset="50%" stopColor="#fde68a"/>
          <stop offset="100%" stopColor="#fcd34d"/>
        </linearGradient>
      </defs>
      <rect width="120" height="120" fill="url(#skyGrad)"/>
      <rect x="5" y="60" width="25" height="60" fill="#92400e" opacity="0.8"/>
      <rect x="5" y="60" width="25" height="60" fill="none" stroke="#78350f" strokeWidth="1"/>
      <rect x="10" y="70" width="5" height="10" fill="#fef3c7"/>
      <rect x="10" y="85" width="5" height="10" fill="#fef3c7"/>
      <rect x="10" y="100" width="5" height="10" fill="#fef3c7"/>
      <rect x="35" y="45" width="20" height="75" fill="#78350f" opacity="0.8"/>
      <rect x="35" y="45" width="20" height="75" fill="none" stroke="#450a0a" strokeWidth="1"/>
      <rect x="40" y="55" width="4" height="10" fill="#fef3c7"/>
      <rect x="40" y="70" width="4" height="10" fill="#fef3c7"/>
      <rect x="40" y="85" width="4" height="10" fill="#fef3c7"/>
      <rect x="40" y="100" width="4" height="10" fill="#fef3c7"/>
      <rect x="60" y="35" width="18" height="85" fill="#92400e" opacity="0.9"/>
      <rect x="60" y="35" width="18" height="85" fill="none" stroke="#450a0a" strokeWidth="1"/>
      <path d="M62 35 Q69 25 78 35" fill="#fbbf24" stroke="#d97706" strokeWidth="1"/>
      <rect x="85" y="55" width="22" height="65" fill="#78350f" opacity="0.8"/>
      <rect x="85" y="55" width="22" height="65" fill="none" stroke="#450a0a" strokeWidth="1"/>
      <rect x="90" y="65" width="4" height="12" fill="#fef3c7"/>
      <rect x="90" y="80" width="4" height="12" fill="#fef3c7"/>
      <rect x="90" y="95" width="4" height="12" fill="#fef3c7"/>
      <circle cx="100" cy="25" r="15" fill="#fbbf24" opacity="0.9"/>
      <circle cx="100" cy="25" r="12" fill="#fde047" opacity="0.6"/>
    </svg>
  );
}

export function FundoParque({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="parkSky" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#bbf7d0"/>
          <stop offset="100%" stopColor="#86efac"/>
        </linearGradient>
      </defs>
      <rect width="120" height="120" fill="url(#parkSky)"/>
      <ellipse cx="60" cy="100" rx="50" ry="30" fill="#16a34a" opacity="0.4"/>
      <ellipse cx="20" cy="80" rx="15" ry="20" fill="#15803d"/>
      <ellipse cx="20" cy="75" rx="10" ry="12" fill="#16a34a"/>
      <ellipse cx="100" cy="85" rx="18" ry="22" fill="#15803d"/>
      <ellipse cx="100" cy="80" rx="12" ry="14" fill="#16a34a"/>
      <ellipse cx="60" cy="70" rx="22" ry="28" fill="#15803d"/>
      <ellipse cx="60" cy="65" rx="15" ry="18" fill="#16a34a"/>
      <path d="M60 98 L60 120" stroke="#166534" strokeWidth="6" strokeLinecap="round"/>
      <path d="M50 105 Q55 100 60 105 Q65 100 70 105" stroke="#166534" strokeWidth="4" fill="none"/>
      <circle cx="30" cy="30" r="8" fill="#fde047" opacity="0.8"/>
      <circle cx="30" cy="30" r="5" fill="#facc15" opacity="0.6"/>
      <path d="M40 20 Q50 15 60 20 Q70 15 80 20" fill="none" stroke="#16a34a" strokeWidth="2" opacity="0.5"/>
      <ellipse cx="60" cy="110" rx="55" ry="15" fill="#166534" opacity="0.2"/>
    </svg>
  );
}

export function FundoEspacial({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="spaceGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1e1b4b"/>
          <stop offset="50%" stopColor="#0f0a2e"/>
          <stop offset="100%" stopColor="#020617"/>
        </radialGradient>
      </defs>
      <rect width="120" height="120" fill="url(#spaceGrad)"/>
      <circle cx="20" cy="20" r="1.5" fill="#fff" opacity="0.9"/>
      <circle cx="80" cy="15" r="1" fill="#fff" opacity="0.7"/>
      <circle cx="100" cy="30" r="0.8" fill="#fff" opacity="0.6"/>
      <circle cx="15" cy="60" r="1.2" fill="#fff" opacity="0.8"/>
      <circle cx="90" cy="70" r="1" fill="#fff" opacity="0.7"/>
      <circle cx="40" cy="90" r="1.5" fill="#fff" opacity="0.9"/>
      <circle cx="110" cy="95" r="0.7" fill="#fff" opacity="0.5"/>
      <circle cx="60" cy="50" r="25" fill="none" stroke="#6366f1" strokeWidth="2" opacity="0.5" strokeDasharray="8,4"/>
      <ellipse cx="60" cy="50" rx="30" ry="18" fill="none" stroke="#8b5cf6" strokeWidth="1.5" opacity="0.4" transform="rotate(-30 60 50)"/>
      <path d="M60 15 Q80 30 60 50 Q40 30 60 15" fill="#1e1b4b" stroke="#a855f7" strokeWidth="2" opacity="0.8"/>
      <ellipse cx="60" cy="50" rx="8" ry="8" fill="#6366f1" opacity="0.9"/>
      <ellipse cx="60" cy="50" rx="5" ry="5" fill="#c084fc"/>
      <path d="M60 50 L90 30" stroke="#a855f7" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="90" cy="30" r="4" fill="#f59e0b"/>
      <circle cx="90" cy="30" r="2" fill="#fde047"/>
      <path d="M30 70 Q40 55 60 50" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeDasharray="4,2"/>
    </svg>
  );
}

// Asset registry
export const ITEM_ASSETS: Record<ItemAssetKey, FC<{ className?: string }>> = {
  bone_basico: BoneBasico,
  bone_civikoo: BoneCivikoo,
  capacete_obra: CapaceteObra,
  chapeu_explorador: ChapeuExplorador,
  colete_amarelo: ColeteAmarelo,
  colete_laranja: ColeteLaranja,
  jaqueta_jeans: JaquetaJeans,
  casaco_premium: CasacoPremium,
  oculos_sol: OculosSol,
  oculos_aviador: OculosAviador,
  relogio_digital: RelogioDigital,
  fone_oversized: FoneOversized,
  fundo_cidade: FundoCidade,
  fundo_parque: FundoParque,
  fundo_espacial: FundoEspacial,
};

export function getItemAsset(key: ItemAssetKey): FC<{ className?: string }> | null {
  return ITEM_ASSETS[key] || null;
}