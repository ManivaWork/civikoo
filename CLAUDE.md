# Civikoo
Um "Waze + Pokémon GO" urbano. Cidadãos passam pela rua, reportam problemas (buraco, lixo, iluminação) com foto e localização, e ganham recompensas de jogo. O jogo serve a um objetivo real: o problema ser resolvido.

## Stack
Next.js (App Router) + TypeScript estrito + Tailwind; react-leaflet com import dinâmico (ssr: false); Supabase (Postgres + PostGIS, Auth, Storage); deploy na Vercel via push para main.

## Estrutura
lib/supabase.ts (cliente), components/MapComponent.tsx (mapa + cliques), app/page.tsx (mapa + formulário).

## Tabela reports (existente)
id, title, description, category (buraco|lixo|iluminacao), latitude, longitude, points, created_at. Há triggers de validação que devem ser preservados.

## Regras do jogo
- Duas moedas: XP (sobe nível, nunca é gasto) e Moedas (gastas em itens do avatar).
- A recompensa de quem reporta fica PENDENTE até outra pessoa confirmar o problema no local.
- Confirmar que o problema continua ou foi resolvido exige estar a até 50 m (validado no servidor com PostGIS ST_DWithin).
- "Resolvido" só vale com 2 confirmações de usuários diferentes.
- XP, moedas, status e user_id NUNCA vêm do cliente: tudo é definido por triggers/funções no banco (SECURITY DEFINER).
- Recompensas reais (comércio local) ficam para uma fase futura, depois do antifraude.

## Regras de trabalho
- Idioma da interface e mensagens: português do Brasil.
- Nunca commitar .env.local.
- Alterações de banco vão em arquivos SQL em supabase/migrations/ (nome com timestamp). Nunca execute SQL; eu executo no Supabase.
- Mobile-first: o uso principal é no celular, andando na rua.
- Antes de alterar arquivos existentes, mostre um plano curto.