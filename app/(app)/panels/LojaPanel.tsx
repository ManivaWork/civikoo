'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Map, Coins, X } from 'lucide-react';
import { useSession } from '@/lib/auth';
import { Avatar, AvatarPreview, MiniAvatar, Item, ItemRarity, ItemSlot, UserItem } from '@/app/components/avatar';
import { fetchItems, fetchUserItems, buyItem } from '@/lib/supabase/client';
import { ITEM_RARITY_CONFIG, ITEM_SLOT_LABELS, getItemRarityConfig, getSlotLabel } from '@/app/components/map/types';
import { useToast } from '@/app/components/ui/Toast';

interface LojaPanelProps {
  onClose: () => void;
}

export function LojaPanel({ onClose }: LojaPanelProps) {
  const { user, profile } = useSession();
  const { show } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [userItems, setUserItems] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<ItemSlot | 'all'>('all');
  const [buyingItemCode, setBuyingItemCode] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<{ slot: ItemSlot; asset: string; code: string; name: string } | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
  }, []);

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
    if (isReady) loadData();
  }, [loadData, isReady]);

  const handleBuy = async (item: Item) => {
    if (!user) return;
    setBuyingItemCode(item.code);
    try {
      const result = await buyItem(item.code);
      show(result.message, 'success');
      const userItemsData = await fetchUserItems(user.id);
      setUserItems(userItemsData);
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

  if (!user || !profile) {
    return (
      <div className="fixed inset-0 z-50 bg-zinc-950 animate-slide-up flex flex-col">
        <header className="fixed top-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800 navbar-safe">
          <div className="max-w-[430px] mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3" aria-label="Civikoo - Início">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                <Map className="w-5 h-5 text-white" aria-hidden="true" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-white">Civikoo</h1>
                <p className="text-xs text-zinc-500">Loja</p>
              </div>
            </Link>
            <button onClick={onClose} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors" aria-label="Fechar">
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>
        <main className="flex-1 pt-20 pb-24 px-4 max-w-[430px] mx-auto w-full">
          <div className="text-center py-16">
            <div className="relative inline-flex items-center justify-center mb-6">
              <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-xl animate-pulse" />
              <div className="relative w-24 h-24 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <Coins className="w-10 h-10 text-zinc-600" aria-hidden="true" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Faça login para acessar a Loja</h2>
            <p className="text-zinc-400 mb-8 max-w-md mx-auto">
              Entre para personalizar seu avatar com itens exclusivos usando suas moedas.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs mx-auto">
              <Link
                href="/login"
                className="flex-1 px-6 py-3 text-center text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                Entrar
              </Link>
              <Link
                href="/cadastro"
                className="flex-1 px-6 py-3 text-center text-sm font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors border border-amber-200 flex items-center justify-center gap-2"
              >
                Cadastrar
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 animate-slide-up flex flex-col">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800 navbar-safe">
        <div className="max-w-[430px] mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3" aria-label="Civikoo - Início">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Map className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-white">Civikoo</h1>
              <p className="text-xs text-zinc-500">Loja</p>
            </div>
          </Link>
          <button onClick={onClose} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 pt-20 pb-24 px-4 max-w-[430px] mx-auto w-full">
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
    </div>
  );
}