'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Map, X } from 'lucide-react';
import { useSession } from '@/lib/auth';
import { Avatar, AvatarPreview, MiniAvatar, ItemSlot, EquippedItems, UserItem } from '@/app/components/avatar';
import { fetchUserItems, equipItem } from '@/lib/supabase/client';
import { ITEM_SLOT_LABELS, getSlotLabel } from '@/app/components/map/types';
import { useToast } from '@/app/components/ui/Toast';

interface ArmarioPanelProps {
  onClose: () => void;
}

export function ArmarioPanel({ onClose }: ArmarioPanelProps) {
  const { user, profile } = useSession();
  const { show } = useToast();
  const [userItems, setUserItems] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [equipped, setEquipped] = useState<EquippedItems>(profile?.equipped ?? {});
  const [activeSlot, setActiveSlot] = useState<ItemSlot>('cabeca');
  const [equipping, setEquipping] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
  }, []);

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
    if (isReady) loadData();
  }, [loadData, isReady]);

  const handleEquip = async (itemCode: string | null, slot: ItemSlot) => {
    if (!user) return;
    setEquipping(itemCode ?? 'unequip');
    try {
      const result = await equipItem(itemCode, slot);
      show(result.message, 'success');
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
                <p className="text-xs text-zinc-500">Armário</p>
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
                <Map className="w-10 h-10 text-zinc-600" aria-hidden="true" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Faça login para acessar o Armário</h2>
            <p className="text-zinc-400 mb-8 max-w-md mx-auto">
              Entre para gerenciar seus itens e personalizar seu avatar.
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
              <p className="text-xs text-zinc-500">Armário</p>
            </div>
          </Link>
          <button onClick={onClose} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 pt-20 pb-24 px-4 max-w-[430px] mx-auto w-full">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Armário</h1>
          <p className="text-zinc-400 text-sm mt-1">Gerencie seus itens e personalize seu avatar</p>
        </div>

        {/* Avatar Preview - Large */}
        <div className="mb-6">
          <AvatarPreview equipped={equipped} size={200} className="mx-auto" />
        </div>

        {/* Slot Tabs */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          {slots.map(slot => (
            <button
              key={slot}
              onClick={() => setActiveSlot(slot)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeSlot === slot
                  ? 'bg-amber-500 text-white shadow-lg'
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              {getSlotLabel(slot)}
              {equipped[slot] && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">✓</span>
              )}
            </button>
          ))}
        </div>

        {/* Items for active slot */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 animate-pulse">
                <div className="h-24 bg-zinc-800 rounded-lg mb-3" />
                <div className="h-4 bg-zinc-800 rounded w-3/4 mb-2" />
                <div className="h-8 bg-zinc-800 rounded w-full" />
              </div>
            ))}
          </div>
        ) : itemsBySlot(activeSlot).length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            <div className="text-4xl mb-2">📦</div>
            <p>Você não possui itens para <strong>{getSlotLabel(activeSlot)}</strong>.</p>
            <p className="text-sm mt-1">Visite a <button onClick={onClose} className="text-amber-400 underline">Loja</button> para comprar novos itens!</p>
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
                  className={`relative group bg-zinc-900 border-2 transition-all duration-200 ${
                    currentlyEquipped
                      ? 'border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/20'
                      : 'border-zinc-800'
                  }`}
                >
                  {/* Equipped badge */}
                  {currentlyEquipped && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400">✓ Equipado</div>
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
                    <h3 className="font-semibold text-white text-sm truncate">{item.name}</h3>
                    <p className="text-xs text-zinc-500 mb-3">{getItemRarityLabel(item.rarity)} • Adquirido em {formatDate(ui.acquired_at)}</p>

                    {/* Equip/Unequip button */}
                    <button
                      onClick={() => handleEquip(currentlyEquipped ? null : item.code, activeSlot)}
                      disabled={isEquippingThis}
                      className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                        currentlyEquipped
                          ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
                          : 'bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700'
                      } ${isEquippingThis ? 'opacity-75 cursor-wait' : ''}`}
                    >
                      {currentlyEquipped ? 'Desequipar' : 'Equipar'}{isEquippingThis && '...'}
                    </button>
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

function getItemRarityLabel(rarity: string): string {
  const labels: Record<string, string> = { comum: 'Comum', raro: 'Raro', epico: 'Épico' };
  return labels[rarity] || rarity;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}