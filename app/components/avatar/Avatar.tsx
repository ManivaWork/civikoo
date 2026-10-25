'use client';

import { FC, memo, useMemo, createElement } from 'react';
import { ItemAssetKey, EquippedItems, ItemSlot } from './types';
import { getItemAsset } from './ItemAssets';

interface AvatarProps {
  equipped?: EquippedItems | null;
  size?: number;
  className?: string;
  showBackground?: boolean;
}

const SLOT_ORDER: ItemSlot[] = ['fundo', 'corpo', 'cabeca', 'acessorio'];

const SLOT_SCALE: Record<ItemSlot, number> = {
  fundo: 1.0,
  corpo: 0.65,
  cabeca: 0.55,
  acessorio: 0.45,
};

const SLOT_OFFSET: Record<ItemSlot, { x: number; y: number }> = {
  fundo: { x: 0, y: 0 },
  corpo: { x: 0, y: 0.15 },
  cabeca: { x: 0, y: -0.35 },
  acessorio: { x: 0, y: -0.15 },
};

function renderAsset(asset: FC<{ className?: string }> | null, className: string) {
  if (!asset) return null;
  return createElement(asset, { className });
}

export const Avatar: FC<AvatarProps> = memo(function Avatar({
  equipped = null,
  size = 120,
  className = '',
  showBackground = true,
}) {
  const layers = useMemo(() => {
    if (!equipped) return [];

    return SLOT_ORDER
      .map((slot) => {
        const itemCode = equipped[slot];
        if (!itemCode) return null;

        const asset = getItemAsset(itemCode as ItemAssetKey);
        if (!asset) return null;

        const scale = SLOT_SCALE[slot];
        const offset = SLOT_OFFSET[slot];

        return (
          <g key={slot} transform={`translate(${size/2 + offset.x * size}, ${size/2 + offset.y * size}) scale(${scale})`}>
            {renderAsset(asset, 'avatar-layer')}
          </g>
        );
      })
      .filter(Boolean);
  }, [equipped, size]);

  return (
    <div className={`avatar-container ${className}`} style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="avatar-svg"
        role="img"
        aria-label="Avatar do jogador"
      >
        {showBackground && (
          <rect
            width={size}
            height={size}
            fill="transparent"
            className="avatar-bg"
          />
        )}
        <g className="avatar-layers">
          {layers}
        </g>
      </svg>
      <style jsx>{`
        .avatar-container {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .avatar-svg {
          width: 100%;
          height: 100%;
        }
        .avatar-layer {
          transform-origin: center center;
        }
        .avatar-bg {
          /* Background placeholder if needed */
        }
      `}</style>
    </div>
  );
});

Avatar.displayName = 'Avatar';

// Mini avatar for navbar/ranking
export interface MiniAvatarProps {
  equipped?: EquippedItems | null;
  size?: number;
  className?: string;
}

export const MiniAvatar: FC<MiniAvatarProps> = memo(function MiniAvatar({
  equipped = null,
  size = 40,
  className = '',
}) {
  const layers = useMemo(() => {
    if (!equipped) return [];

    return SLOT_ORDER
      .map((slot) => {
        const itemCode = equipped[slot];
        if (!itemCode) return null;

        const asset = getItemAsset(itemCode as ItemAssetKey);
        if (!asset) return null;

        const scale = SLOT_SCALE[slot] * 0.7; // Smaller for mini
        const offset = SLOT_OFFSET[slot];

        return (
          <g key={slot} transform={`translate(${size/2 + offset.x * size}, ${size/2 + offset.y * size}) scale(${scale})`}>
            {renderAsset(asset, 'avatar-layer')}
          </g>
        );
      })
      .filter(Boolean);
  }, [equipped, size]);

  return (
    <div className={`mini-avatar-container ${className}`} style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="mini-avatar-svg"
        role="img"
        aria-label="Avatar do jogador"
      >
        <g className="avatar-layers">
          {layers}
        </g>
      </svg>
      <style jsx>{`
        .mini-avatar-container {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }
        .mini-avatar-svg {
          width: 100%;
          height: 100%;
        }
        .avatar-layer {
          transform-origin: center center;
        }
      `}</style>
    </div>
  );
});

MiniAvatar.displayName = 'MiniAvatar';

// Avatar preview for shop/wardrobe
export interface AvatarPreviewProps {
  equipped?: EquippedItems | null;
  previewItem?: { slot: ItemSlot; asset: string } | null;
  size?: number;
  className?: string;
}

interface AvatarLayer {
  slot: ItemSlot;
  asset: FC<{ className?: string }>;
  scale: number;
  offset: { x: number; y: number };
  isPreview: boolean;
}

export const AvatarPreview: FC<AvatarPreviewProps> = memo(function AvatarPreview({
  equipped = null,
  previewItem = null,
  size = 160,
  className = '',
}) {
  const layers = useMemo((): AvatarLayer[] => {
    const baseLayers: AvatarLayer[] = SLOT_ORDER
      .map((slot): AvatarLayer | null => {
        const itemCode = equipped?.[slot];
        if (!itemCode) return null;

        const asset = getItemAsset(itemCode as ItemAssetKey);
        if (!asset) return null;

        const scale = SLOT_SCALE[slot];
        const offset = SLOT_OFFSET[slot];

        return { slot, asset, scale, offset, isPreview: false };
      })
      .filter((l): l is AvatarLayer => l !== null);

    if (previewItem) {
      const existingIndex = baseLayers.findIndex(l => l.slot === previewItem.slot);
      const previewAsset = getItemAsset(previewItem.asset as ItemAssetKey);

      if (previewAsset) {
        const previewLayer: AvatarLayer = {
          slot: previewItem.slot,
          asset: previewAsset,
          scale: SLOT_SCALE[previewItem.slot],
          offset: SLOT_OFFSET[previewItem.slot],
          isPreview: true,
        };

        if (existingIndex >= 0) {
          baseLayers[existingIndex] = previewLayer;
        } else {
          baseLayers.push(previewLayer);
        }
      }
    }

    return baseLayers.sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
  }, [equipped, previewItem, size]);

  return (
    <div className={`avatar-preview-container ${className}`} style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="avatar-preview-svg"
        role="img"
        aria-label="Pré-visualização do avatar"
      >
        <rect
          width={size}
          height={size}
          fill="#fafafa"
          className="preview-bg"
        />
        <g className="avatar-layers">
          {layers.map((layer) => (
            <g
              key={layer.slot}
              transform={`translate(${size/2 + layer.offset.x * size}, ${size/2 + layer.offset.y * size}) scale(${layer.scale})`}
              className={layer.isPreview ? 'preview-layer' : ''}
            >
              {renderAsset(layer.asset, 'avatar-layer')}
            </g>
          ))}
        </g>
      </svg>
      <style jsx>{`
        .avatar-preview-container {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          border: 2px solid #e5e7eb;
          background: #fafafa;
          overflow: hidden;
        }
        .dark .avatar-preview-container {
          border-color: #374151;
          background: #1f2937;
        }
        .avatar-preview-svg {
          width: 100%;
          height: 100%;
        }
        .avatar-layer {
          transform-origin: center center;
        }
        .preview-layer {
          filter: drop-shadow(0 0 8px #f59e0b);
        }
        .preview-bg {
          /* Background */
        }
      `}</style>
    </div>
  );
});

AvatarPreview.displayName = 'AvatarPreview';