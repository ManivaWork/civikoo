'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Map, Coins } from 'lucide-react';
import { useSession } from '@/lib/auth';
import { Avatar, AvatarPreview, MiniAvatar, Item, ItemRarity, ItemSlot, UserItem } from '@/app/components/avatar';
import { fetchItems, fetchUserItems, buyItem } from '@/lib/supabase/client';
import { ITEM_RARITY_CONFIG, ITEM_SLOT_LABELS, getItemRarityConfig, getSlotLabel } from '@/app/components/map/types';
import { useToast } from '@/app/components/ui/Toast';
import { BottomNavigation } from '@/app/components/ui/BottomNavigation';

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
      const userItemsData = await fetchUserItems(user.id);
      setUserItems(userItemsData);
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
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800 navbar-safe">
        <div className="max-w-screen-xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3" aria-label="Civikoo - Início">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Map className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-white">Civikoo</h1>
              <p className="text-xs text-zinc-500">Loja</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {/* Coins display */}
            <div className="hidden md:flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5">
              <span className="text-2xl">🪙</span>
              <span className="text-lg font-bold text-amber-400">{profile?.coins ?? 0}</span>
              <span className="text-xs text-zinc-500">moedas</span>
            </div>

            {/* Avatar */}
            <Link
              href="/perfil"
              className="relative w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center hover:border-zinc-700 transition-colors"
              aria-label="Meu perfil"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-500 to-amber-600">
                  <span className="text-white font-bold text-lg">
                    {profile?.username?.charAt(0).toUpperCase() || "?"}
                  </span>
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-zinc-950">
                {profile?.level ?? 1}
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-20 pb-24 px-4 max-w-screen-xl mx-auto w-full">
        {/* Header with coins (mobile) */}
        <div className="md:hidden mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Loja</h1>
            <p className="text-zinc-400 text-sm mt-1">Personalize seu avatar com itens exclusivos</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full">
            <span className="text-xl">🪙</span>
            <span className="text-lg font-bold text-amber-400">{profile?.coins ?? 0}</span>
            <span className="text-sm text-zinc-500">Moedas</span>
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:block mb-6">
          <h1 className="text-2xl font-bold text-white">Loja</h1>
          <p className="text-zinc-400 text-sm mt-1">Personalize seu avatar com itens exclusivos</p>
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
                  ? 'bg-amber-500 text-white shadow-lg'
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200'
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
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 animate-pulse">
                <div className="h-24 bg-zinc-800 rounded-lg mb-3" />
                <div className="h-4 bg-zinc-800 rounded w-3/4 mb-2" />
                <div className="h-3 bg-zinc-800 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">Nenhum item encontrado para esta categoria.</div>
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
                  className={`relative group bg-zinc-900 border-2 transition-all duration-200 ${
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
                    <h3 className="font-semibold text-white text-sm truncate">{item.name}</h3>
                    <p className="text-xs text-zinc-500 mb-2">{getSlotLabel(item.slot)} • Nv. {item.min_level}+</p>

                    {/* Buy/Owned button */}
                    {owned ? (
                      <button className="w-full py-2 bg-zinc-800 text-zinc-500 rounded-lg text-sm font-medium" disabled>✓ Adquirido</button>
                    ) : (
                      <button
                        onClick={() => handleBuy(item)}
                        disabled={buyingItemCode === item.code || !levelOk || !affordable}
                        className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                          buyingItemCode === item.code
                            ? 'bg-amber-400 text-white cursor-wait'
                            : !levelOk
                            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                            : !affordable
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20 cursor-not-allowed'
                            : 'bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700'
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

      <BottomNavigation />
    </div>
  );
}