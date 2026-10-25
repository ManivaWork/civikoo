'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from '@/lib/auth';
import { Avatar, AvatarPreview, MiniAvatar, Item, ItemRarity, ItemSlot, UserItem } from '@/app/components/avatar';
import { fetchItems, fetchUserItems, buyItem } from '@/lib/supabase/client';
import { ITEM_RARITY_CONFIG, ITEM_SLOT_LABELS, getItemRarityConfig, getSlotLabel } from '@/app/components/map/types';
import { useToast } from '@/app/components/ui/Toast';

export default function LojaPage() {
  const { user, profile } = useSession();
  const { show } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [userItems, setUserItems] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<ItemSlot | 'all'>('all');
  const [buyingItemCode, setBuyingItemCode] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<{ slot: ItemSlot; asset: string; code: string; name: string } | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [itemsData, userItemsData] = await Promise.all([
        fetchItems(),
        fetchUserItems(user.id),
      ]);
      setItems(itemsData);
      setUserItems(userItemsData);
    } catch (err) {
      console.error('Erro ao carregar loja:', err);
      show('Erro ao carregar loja', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, show]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBuy = async (item: Item) => {
    if (!user) return;
    setBuyingItemCode(item.code);
    try {
      const result = await buyItem(item.code);
      show(result.message, 'success');
      // Refresh user items and profile
      const userItemsData = await fetchUserItems(user.id);
      setUserItems(userItemsData);
      // Trigger profile refresh by reloading
      window.location.reload();
    } catch (err: any) {
      show(err.message, 'error');
    } finally {
      setBuyingItemCode(null);
    }
  };

  const isOwned = (itemCode: string) => {
    return userItems.some(ui => ui.item?.code === itemCode);
  };

  const canAfford = (price: number) => {
    return (profile?.coins ?? 0) >= price;
  };

  const canBuy = (item: Item) => {
    return !isOwned(item.code) && canAfford(item.price_coins) && (profile?.level ?? 1) >= item.min_level;
  };

  const filteredItems = items.filter(item => {
    if (activeFilter === 'all') return true;
    return item.slot === activeFilter;
  });

  const slots: (ItemSlot | 'all')[] = ['all', 'cabeca', 'corpo', 'acessorio', 'fundo'];

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
              <MiniAvatar equipped={profile?.equipped ?? null} size={32} />
              <span>{profile?.username}</span>
              <span className="px-2 py-0.5 bg-amber-600 text-white text-xs rounded-full font-bold">
                Nv.{profile?.level ?? 1}
              </span>
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-20 pb-24 px-4 max-w-screen-xl mx-auto">
        {/* Header with coins */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Loja</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
              Personalize seu avatar com itens exclusivos
            </p>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 rounded-full border border-amber-300 dark:border-amber-700">
            <span className="text-2xl">🪙</span>
            <span className="text-lg font-bold text-amber-700 dark:text-amber-300">
              {profile?.coins ?? 0}
            </span>
            <span className="text-sm text-amber-600 dark:text-amber-400">Moedas</span>
          </div>
        </div>

        {/* Avatar Preview */}
        <div className="mb-6">
          <AvatarPreview
            equipped={profile?.equipped ?? null}
            previewItem={previewItem ? { slot: previewItem.slot, asset: previewItem.asset as any } : null}
            size={180}
            className="mx-auto"
          />
        </div>

        {/* Filter Tabs */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          {slots.map(slot => (
            <button
              key={slot}
              onClick={() => setActiveFilter(slot)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeFilter === slot
                  ? 'bg-amber-600 text-white shadow-lg'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
              }`}
            >
              {slot === 'all' ? 'Todos' : getSlotLabel(slot)}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
                <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg mb-3" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Nenhum item encontrado para esta categoria.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredItems.map(item => {
              const owned = isOwned(item.code);
              const affordable = canAfford(item.price_coins);
              const levelOk = (profile?.level ?? 1) >= item.min_level;
              const rarityConfig = getItemRarityConfig(item.rarity);

              return (
                <div
                  key={item.code}
                  className={`relative group bg-white dark:bg-gray-800 rounded-xl border-2 transition-all duration-200 ${
                    rarityConfig.borderColor
                  } ${owned ? 'opacity-60' : ''}`}
                  onMouseEnter={() => setPreviewItem({ slot: item.slot, asset: item.asset, code: item.code, name: item.name })}
                  onMouseLeave={() => setPreviewItem(null)}
                >
                  {/* Rarity badge */}
                  <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-bold ${rarityConfig.bgColor} ${rarityConfig.color}`}>
                    {rarityConfig.label}
                  </div>

                  {/* Item preview */}
                  <div className="aspect-square relative mb-3">
                    <AvatarPreview
                      equipped={profile?.equipped ?? null}
                      previewItem={{ slot: item.slot, asset: item.asset }}
                      size={120}
                      className="mx-auto"
                    />
                  </div>

                  {/* Item info */}
                  <div className="px-3 pb-3">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                      {item.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      {getSlotLabel(item.slot)} • Nv. {item.min_level}+
                    </p>

                    {/* Buy/Owned button */}
                    {owned ? (
                      <button
                        className="w-full py-2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg text-sm font-medium"
                        disabled
                      >
                        ✓ Adquirido
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBuy(item)}
                        disabled={buyingItemCode === item.code || !levelOk || !affordable}
                        className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                          buyingItemCode === item.code
                            ? 'bg-amber-400 text-white cursor-wait'
                            : !levelOk
                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                            : !affordable
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 cursor-not-allowed border border-red-300 dark:border-red-700'
                            : 'bg-amber-600 text-white hover:bg-amber-700 active:bg-amber-800'
                        }`}
                      >
                        {buyingItemCode === item.code ? (
                          'Comprando...'
                        ) : !levelOk ? (
                          `Nv. ${item.min_level} necessário`
                        ) : !affordable ? (
                          `${item.price_coins} 🪙 (Saldo: ${profile?.coins ?? 0})`
                        ) : (
                          `Comprar por ${item.price_coins} 🪙`
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-700 bottom-sheet-safe">
        <div className="grid grid-cols-4 max-w-screen-xl mx-auto">
          <Link href="/" className="flex flex-col items-center py-3 text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
            <span className="text-xl">🗺️</span>
            <span className="text-xs font-medium">Mapa</span>
          </Link>
          <Link href="/loja" className="flex flex-col items-center py-3 text-amber-600 dark:text-amber-400">
            <span className="text-xl">🛍️</span>
            <span className="text-xs font-medium">Loja</span>
          </Link>
          <Link href="/armario" className="flex flex-col items-center py-3 text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
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