export type ItemSlot = 'cabeca' | 'corpo' | 'acessorio' | 'fundo';
export type ItemRarity = 'comum' | 'raro' | 'epico';

export type ItemAssetKey =
  | 'bone_basico'
  | 'bone_civikoo'
  | 'capacete_obra'
  | 'chapeu_explorador'
  | 'colete_amarelo'
  | 'colete_laranja'
  | 'jaqueta_jeans'
  | 'casaco_premium'
  | 'oculos_sol'
  | 'oculos_aviador'
  | 'relogio_digital'
  | 'fone_oversized'
  | 'fundo_cidade'
  | 'fundo_parque'
  | 'fundo_espacial';

// Re-export from map types to avoid duplication
export type { Item, UserItem, EquippedItems, UserProfileWithItems } from '@/app/components/map/types';