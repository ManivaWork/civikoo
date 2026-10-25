import { createBrowserClient } from "@supabase/ssr";
import { Item, UserItem, UserMissionWithTemplate, StreakInfo } from '@/app/components/map/types';

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (browserClient) return browserClient;

  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return browserClient;
}

/**
 * Resize image to maxWidth (default 1280) and compress to JPEG/WebP <= 5MB.
 * Returns a Blob ready for upload.
 */
export async function resizeImageFile(file: File, maxWidth = 1280, maxSizeBytes = 5 * 1024 * 1024): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      // Try WebP first, fallback to JPEG
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Falha ao comprimir imagem'));
          if (blob.size > maxSizeBytes) {
            // If still too large, reduce quality iteratively
            let quality = 0.8;
            const attempt = (q: number) => {
              canvas.toBlob((b) => {
                if (!b) return reject(new Error('Falha ao comprimir imagem'));
                if (b.size > maxSizeBytes && q > 0.1) {
                  attempt(q - 0.1);
                } else {
                  resolve(b);
                }
              }, 'image/webp', q);
            };
            attempt(quality);
          } else {
            resolve(blob);
          }
        },
        'image/webp',
        0.85
      );
    };
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = url;
  });
}

/**
 * Upload a report image to Storage bucket 'report-images' under {userId}/{uuid}.ext
 * Returns the public URL.
 */
/**
 * Confirm a report (continua or resolvido) with server-side proximity check
 *
 * LIMITAÇÕES CONHECIDAS (GPS falsificável):
 * - O cliente envia latitude, longitude e accuracy, mas esses valores podem ser manipulados
 *   (mock location apps, GPS spoofing, developer tools, etc.)
 * - O servidor valida a distância (50m) e accuracy (<100m), mas não pode garantir autenticidade
 *
 * MITIGAÇÕES FUTURAS SUGERIDAS:
 * 1. Verificação de consistência de movimento (velocidade impossível, teleport entre confirmações)
 * 2. Cross-reference com Wi-Fi/Cell tower triangulation (quando disponível via APIs nativas)
 * 3. Reputação do usuário: usuários novos têm peso menor nas confirmações
 * 4. Detecção de anomalia estatística: padrões suspeitos (mesmo horário, mesma rota, muitos reports)
 * 5. Integração com APIs de integridade (Google Play Integrity, App Attest, DeviceCheck)
 * 6. Requerer foto com EXIF GPS metadata e verificar consistência com coordenadas enviadas
 * 7. Rate limiting mais agressivo por device/fingerprint além de por usuário
 * 8. Auditoria manual de usuários com muitos reports/confirmações em pouco tempo
 */
export async function confirmReport(
  reportId: string,
  userId: string,
  tipo: 'continua' | 'resolvido',
  latitude: number,
  longitude: number,
  accuracy?: number
): Promise<{ success: boolean; message: string; distance_m: number; accuracy_m?: number }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('confirm_report', {
    p_report_id: reportId,
    p_user_id: userId,
    p_type: tipo,
    p_latitude: latitude,
    p_longitude: longitude,
    p_accuracy: accuracy ?? null,
  });

  if (error) {
    // Extrair mensagem amigável do erro do servidor
    const msg = extractErrorMessage(error.message);
    throw new Error(msg);
  }

  return data as { success: boolean; message: string; distance_m: number; accuracy_m?: number };
}

/**
 * Flag/report a report
 *
 * LIMITAÇÕES CONHECIDAS:
 * - Um usuário malicioso pode coordenar denúncias em massa (brigading)
 * - Não há verificação de que o denunciante esteve no local
 *
 * MITIGAÇÕES FUTURAS SUGERIDAS:
 * 1. Exigir proximidade (<100m) para denunciar, similar à confirmação
 * 2. Peso da denúncia baseado na reputação do denunciante
 * 3. Detecção de padrões coordenados (muitas denúncias do mesmo IP/device/rede)
 * 4. Sistema de apelação para autores de reports ocultados
 * 5. Moderação humana para casos limítrofes
 */
export async function flagReport(
  reportId: string,
  userId: string,
  reason: 'falso' | 'duplicado' | 'ofensivo' | 'outro'
): Promise<{ success: boolean; message: string; flags_count: number; hidden: boolean }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('flag_report', {
    p_report_id: reportId,
    p_user_id: userId,
    p_reason: reason,
  });

  if (error) {
    const msg = extractErrorMessage(error.message);
    throw new Error(msg);
  }

  return data as { success: boolean; message: string; flags_count: number; hidden: boolean };
}

/**
 * Check for nearby reports (used to suggest confirming instead of creating duplicate)
 */
export async function findNearbyReports(
  latitude: number,
  longitude: number,
  category: string,
  radiusMeters: number = 30
): Promise<Array<{ id: string; title: string; category: string; distance_m: number }>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('reports_nearby', {
    p_latitude: latitude,
    p_longitude: longitude,
    p_radius_meters: radiusMeters,
    p_category: category,
  });

  if (error) throw error;
  return (data as Array<{ id: string; title: string; category: string; distance_m: number }>) || [];
}

/**
 * Extract user-friendly error message from Supabase error
 */
function extractErrorMessage(errorMessage: string): string {
  // Erros customizados do banco começam com códigos específicos
  if (errorMessage.includes('LIMITE_EXCEDIDO:')) {
    return 'Você atingiu o limite de 20 reportes nas últimas 24 horas. Tente novamente mais tarde.';
  }
  if (errorMessage.includes('REPORTE_DUPLICADO:')) {
    // Extrair a mensagem após o código
    const match = errorMessage.match(/REPORTE_DUPLICADO: (.+)$/);
    return match ? match[1] : 'Já existe um reporte similar próximo. Considere confirmar o existente.';
  }
  if (errorMessage.includes('FORA_DE_ALCANCE:')) {
    const match = errorMessage.match(/FORA_DE_ALCANCE: (.+)$/);
    return match ? match[1] : 'Você precisa estar mais próximo do local (máx. 50m).';
  }
  if (errorMessage.includes('GPS_PRECISAO_BAIXA:')) {
    const match = errorMessage.match(/GPS_PRECISAO_BAIXA: (.+)$/);
    return match ? match[1] : 'A precisão do GPS está muito baixa. Melhore o sinal e tente novamente.';
  }
  if (errorMessage.includes('LIMITE_CONFIRMACOES:')) {
    return 'Você atingiu o limite de 30 confirmações nas últimas 24 horas.';
  }
  if (errorMessage.includes('COOLDOWN_CONFIRMACAO:')) {
    return 'Aguarde 30 segundos antes de confirmar novamente.';
  }
  if (errorMessage.includes('JA_CONFIRMOU:')) {
    return 'Você já confirmou este reporte.';
  }
  if (errorMessage.includes('JA_DENUNCIOU:')) {
    return 'Você já denunciou este reporte.';
  }
  if (errorMessage.includes('REPORTE_NAO_ENCONTRADO:')) {
    return 'Reporte não encontrado.';
  }
  // Erro genérico
  return 'Ocorreu um erro. Tente novamente.';
}

export async function uploadReportImage(file: File, userId: string): Promise<string> {
  const supabase = createClient();
  // Resize/compress
  const blob = await resizeImageFile(file);
  // Build filename
  const ext = file.name.split('.').pop()?.toLowerCase() || 'webp';
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const path = `${userId}/${fileName}`;

  const { error } = await supabase.storage
    .from('report-images')
    .upload(path, blob, {
      contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage.from('report-images').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Buy an item from the shop
 */
export async function buyItem(itemCode: string): Promise<{
  success: boolean;
  message: string;
  item_code: string;
  coins_spent: number;
  new_balance: number;
}> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('buy_item', {
    p_item_code: itemCode,
  });

  if (error) {
    const msg = extractErrorMessage(error.message);
    throw new Error(msg);
  }

  return data as {
    success: boolean;
    message: string;
    item_code: string;
    coins_spent: number;
    new_balance: number;
  };
}

/**
 * Equip or unequip an item
 */
export async function equipItem(
  itemCode: string | null,
  slot: 'cabeca' | 'corpo' | 'acessorio' | 'fundo'
): Promise<{
  success: boolean;
  message: string;
  slot: string;
  item_code: string | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('equip_item', {
    p_item_code: itemCode,
    p_slot: slot,
  });

  if (error) {
    const msg = extractErrorMessage(error.message);
    throw new Error(msg);
  }

  return data as {
    success: boolean;
    message: string;
    slot: string;
    item_code: string | null;
  };
}

/**
 * Fetch all active items from the shop
 */
export async function fetchItems(): Promise<Item[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('active', true)
    .order('slot')
    .order('price_coins');

  if (error) throw error;
  return (data as Item[]) || [];
}

/**
 * Fetch user's owned items
 */
export async function fetchUserItems(userId: string): Promise<UserItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('user_items')
    .select(`
      user_id,
      item_id,
      acquired_at,
      item:items(*)
    `)
    .eq('user_id', userId);

  if (error) throw error;
  return (data as Array<any>) || [];
}

/**
 * Fetch user's missions for current period (creates if needed)
 */
export async function getMyMissions(): Promise<UserMissionWithTemplate[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_my_missions');

  if (error) throw error;
  return (data as UserMissionWithTemplate[]) || [];
}

/**
 * Claim a completed mission reward
 */
export async function claimMission(userMissionId: string): Promise<{
  success: boolean;
  message: string;
  xp_earned: number;
  coins_earned: number;
}> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('claim_mission', {
    p_user_mission_id: userMissionId,
  });

  if (error) {
    const msg = extractErrorMessage(error.message);
    throw new Error(msg);
  }

  return data as {
    success: boolean;
    message: string;
    xp_earned: number;
    coins_earned: number;
  };
}

/**
 * Fetch reports within a bounding box (viewport) with optional filters
 * Uses the reports_in_bounds RPC with GIST index for efficient spatial queries
 */
export async function fetchReportsInBounds(params: {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
  categories?: string[];
  statuses?: string[];
  userId?: string;
  onlyMine?: boolean;
  sinceDays?: number;
  limit?: number;
}): Promise<any[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("reports_in_bounds", {
    p_min_lat: params.minLat,
    p_min_lng: params.minLng,
    p_max_lat: params.maxLat,
    p_max_lng: params.maxLng,
    p_categories: params.categories ?? null,
    p_statuses: params.statuses ?? null,
    p_user_id: params.userId ?? null,
    p_only_mine: params.onlyMine ?? false,
    p_since_days: params.sinceDays ?? null,
    p_limit: params.limit ?? 500,
  });

  if (error) throw error;
  return (data as any[]) || [];
}

/**
 * Fetch user's streak info
 */
export async function getStreakInfo(userId: string): Promise<StreakInfo> {
  const supabase = createClient();

  // Fetch profile with streak columns
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('streak_count, best_streak, last_active_date')
    .eq('id', userId)
    .single();

  if (profileError) throw profileError;

  // Fetch earned milestones
  const { data: milestones, error: milestonesError } = await supabase
    .from('user_streak_milestones')
    .select('milestone_days')
    .eq('user_id', userId);

  if (milestonesError) throw milestonesError;

  const earnedMilestones = (milestones || []).map((m: { milestone_days: number }) => m.milestone_days).sort((a: number, b: number) => a - b);
  const allMilestones = [3, 7, 14, 30];
  const nextMilestone = allMilestones.find(m => !earnedMilestones.includes(m)) || null;
  const currentStreak = profile?.streak_count || 0;
  const daysToNext = nextMilestone ? Math.max(0, nextMilestone - currentStreak) : null;

  return {
    streak_count: currentStreak,
    best_streak: profile?.best_streak || 0,
    last_active_date: profile?.last_active_date || null,
    next_milestone: nextMilestone,
    days_to_next_milestone: daysToNext,
    milestones_earned: earnedMilestones,
  };
}