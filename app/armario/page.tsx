'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from '@/lib/auth';
import { Avatar, AvatarPreview, MiniAvatar, ItemSlot, EquippedItems, UserItem } from '@/app/components/avatar';
import { fetchUserItems, equipItem } from '@/lib/supabase/client';
import { ITEM_SLOT_LABELS, getSlotLabel } from '@/app/components/map/types';
import { useToast } from '@/app/components/ui/Toast';

export default function ArmarioPage() {
  const { user, profile } = useSession();
  const { show } = useToast();
  const [userItems, setUserItems] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [equipped, setEquipped] = useState<EquippedItems>(profile?.equipped ?? {});
  const [activeSlot, setActiveSlot] = useState<ItemSlot>('cabeca');
  const [equipping, setEquipping] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await fetchUserItems(user.id);
      setUserItems(data);
      setEquipped(profile?.equipped ?? {});
    } catch (err) {
      console.error('Erro ao carregar armário:', err);
      show('Erro ao carregar armário', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, profile?.equipped, show]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEquip = async (itemCode: string | null, slot: ItemSlot) => {
    if (!user) return;
    setEquipping(itemCode ?? 'unequip');
    try {
      const result = await equipItem(itemCode, slot);
      show(result.message, 'success');
      // Update local state immediately
      setEquipped((prev: EquippedItems) => ({
        ...prev,
        [slot]: result.item_code,
      }));
    } catch (err: any) {
      show(err.message, 'error');
    } finally {
      setEquipping(null);
    }
  };

  const itemsBySlot = (slot: ItemSlot) => {
    return userItems.filter(ui => ui.item?.slot === slot);
  };

  const isEquipped = (itemCode: string, slot: ItemSlot) => {
    return equipped[slot] === itemCode;
  };

  const slots: ItemSlot[] = ['cabeca', 'corpo', 'acessorio', 'fundo'];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navbar */}
      <nav className="navbar-safe fixed top-0 left-0 right-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-screen-xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-amber-600 dark:text-amber-400">
            Civikoo
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/perfil" className="flex items-center gap-2 px-3 py-2 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-sm font-medium">
              <MiniAvatar equipped={equipped} size={32} />
              <span>{profile?.username}</span>
              <span className="px-2 py-0.5 bg-amber-600 text-white text-xs rounded-full font-bold">
                Nv.{profile?.level ?? 1}
              </span>
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-20 pb-24 px-4 max-w-screen-xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Armário</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            Gerencie seus itens e personalize seu avatar
          </p>
        </div>

        {/* Avatar Preview - Large */}
        <div className="mb-6">
          <AvatarPreview
            equipped={equipped}
            size={200}
            className="mx-auto"
          />
        </div>

        {/* Slot Tabs */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          {slots.map(slot => (
            <button
              key={slot}
              onClick={() => setActiveSlot(slot)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeSlot === slot
                  ? 'bg-amber-600 text-white shadow-lg'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
              }`}
            >
              {getSlotLabel(slot)}
              {equipped[slot] && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs rounded-full">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Items for active slot */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
                <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg mb-3" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full" />
              </div>
            ))}
          </div>
        ) : itemsBySlot(activeSlot).length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <div className="text-4xl mb-2">📦</div>
            <p>Você não possui itens para <strong>{getSlotLabel(activeSlot)}</strong>.</p>
            <p className="text-sm mt-1">Visite a <Link href="/loja" className="text-amber-600 dark:text-amber-400 underline">Loja</Link> para comprar novos itens!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {itemsBySlot(activeSlot).map(ui => {
              const item = ui.item!;
              const currentlyEquipped = isEquipped(item.code, activeSlot);
              const isEquippingThis = equipping === item.code || (equipping === 'unequip' && currentlyEquipped);

              return (
                <div
                  key={ui.item_id}
                  className={`relative group bg-white dark:bg-gray-800 rounded-xl border-2 transition-all duration-200 ${
                    currentlyEquipped
                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 ring-2 ring-amber-400'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {/* Equipped badge */}
                  {currentlyEquipped && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                      ✓ Equipado
                    </div>
                  )}

                  {/* Item preview */}
                  <div className="aspect-square relative mb-3">
                    <AvatarPreview
                      equipped={equipped}
                      previewItem={currentlyEquipped ? null : { slot: item.slot, asset: item.asset }}
                      size={120}
                      className="mx-auto"
                    />
                  </div>

                  {/* Item info */}
                  <div className="px-3 pb-3">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                      {item.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      {getItemRarityLabel(item.rarity)} • Adquirido em {formatDate(ui.acquired_at)}
                    </p>

                    {/* Equip/Unequip button */}
                    <button
                      onClick={() => handleEquip(currentlyEquipped ? null : item.code, activeSlot)}
                      disabled={isEquippingThis}
                      className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                        currentlyEquipped
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                          : 'bg-amber-600 text-white hover:bg-amber-700 active:bg-amber-800'
                      } ${isEquippingThis ? 'opacity-75 cursor-wait' : ''}`}
                    >
                      {currentlyEquipped ? 'Desequipar' : 'Equipar'}
                      {isEquippingThis && '...'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state for slot if no items */}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-700 bottom-sheet-safe">
        <div className="grid grid-cols-4 max-w-screen-xl mx-auto">
          <Link href="/" className="flex flex-col items-center py-3 text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
            <span className="text-xl">🗺️</span>
            <span className="text-xs font-medium">Mapa</span>
          </Link>
          <Link href="/loja" className="flex flex-col items-center py-3 text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
            <span className="text-xl">🛍️</span>
            <span className="text-xs font-medium">Loja</span>
          </Link>
          <Link href="/armario" className="flex flex-col items-center py-3 text-amber-600 dark:text-amber-400">
            <span className="text-xl">👕</span>
            <span className="text-xs font-medium">Armário</span>
          </Link>
          <Link href="/perfil" className="flex flex-col items-center py-3 text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
            <span className="text-xl">👤</span>
            <span className="text-xs font-medium">Perfil</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}

function getItemRarityLabel(rarity: string): string {
  const labels: Record<string, string> = {
    comum: 'Comum',
    raro: 'Raro',
    epico: 'Épico',
  };
  return labels[rarity] || rarity;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}