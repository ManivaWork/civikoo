# Plano de Implementação: Supabase Auth no Civikoo

## Resumo das Mudanças

| # | Arquivo | Ação |
|---|---------|------|
| 1 | `package.json` | Instalar `@supabase/ssr` |
| 2 | `lib/supabase/client.ts` | **Novo** - Cliente Supabase para browser |
| 3 | `lib/supabase/server.ts` | **Novo** - Cliente Supabase para servidor (Server Components, Actions, Middleware) |
| 4 | `lib/supabase.ts` | **Remover** - Substituído pelos dois acima |
| 5 | `middleware.ts` | **Novo** - Atualiza sessão a cada request |
| 6 | `app/login/page.tsx` | **Novo** - Página de login (e-mail + senha) |
| 7 | `app/cadastro/page.tsx` | **Novo** - Página de cadastro (e-mail + senha) |
| 8 | `app/components/ui/Navbar.tsx` | **Novo** - Navbar com auth state (entrar/cadastrar | user + sair + XP/moedas placeholder) |
| 9 | `app/layout.tsx` | Atualizar - Adicionar Navbar, lang="pt-BR" |
| 10 | `app/page.tsx` | Atualizar - Condicionar formulário de reporte a usuário logado; mostrar aviso com link p/ login se deslogado |

---

## Detalhes por Arquivo

### 1. `package.json`
```json
"dependencies": {
  ...,
  "@supabase/ssr": "^0.5.0"
}
```

### 2. `lib/supabase/client.ts`
- `createBrowserClient` com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Exportar `createClient` (singleton pattern para evitar múltiplas instâncias)

### 3. `lib/supabase/server.ts`
- `createServerClient` com `cookies()` do `next/headers`
- Para uso em Server Components, Server Actions, API Routes

### 4. `middleware.ts`
- `createServerClient` com `request.cookies` e `response.cookies`
- `updateSession` a cada request (padrão oficial SSR)
- Proteger rotas se necessário (por enquanto só atualiza sessão)

### 5. `app/login/page.tsx` (Client Component)
- Formulário: e-mail, senha, botão "Entrar"
- Loading state, mensagens de erro em PT-BR
- Link para `/cadastro`
- Redirecionar para `/` após login bem-sucedido

### 6. `app/cadastro/page.tsx` (Client Component)
- Formulário: e-mail, senha, confirmar senha, botão "Cadastrar"
- Loading state, mensagens de erro em PT-BR
- Link para `/login`
- Redirecionar para `/` após cadastro bem-sucedido

### 7. `app/components/ui/Navbar.tsx` (Client Component)
- **Deslogado**: "Entrar" (link `/login`) | "Cadastrar" (link `/cadastro`)
- **Logado**: 
  - Avatar/Inicial do e-mail
  - E-mail (ou username futuramente)
  - Placeholder: "XP: — | Moedas: —"
  - Botão "Sair" (signOut + redirect `/`)
- Responsivo (mobile-first)
- `useSession` ou `getUser` via Supabase client

### 8. `app/layout.tsx`
- Adicionar `<Navbar />` antes do `{children}`
- `lang="pt-BR"`
- Manter fonts Geist

### 9. `app/page.tsx`
- Verificar se usuário logado (via `getUser` no client ou Server Component)
- **Logado**: Mostrar `NewReportFab` + `NewReportModal` (comportamento atual)
- **Deslogado**: No lugar do FAB/modal, mostrar card/aviso:
  - "Faça login para reportar problemas"
  - Botão "Entrar" → `/login`
  - Botão "Cadastrar" → `/cadastro`
- Mapa continua visível para todos

---

## Variáveis de Ambiente (já existentes em `.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## Ordem de Execução Sugerida
1. Instalar `@supabase/ssr`
2. Criar `lib/supabase/client.ts` e `lib/supabase/server.ts`
3. Remover `lib/supabase.ts`
4. Criar `middleware.ts`
5. Criar `app/login/page.tsx`
6. Criar `app/cadastro/page.tsx`
7. Criar `app/components/ui/Navbar.tsx`
8. Atualizar `app/layout.tsx`
9. Atualizar `app/page.tsx`
10. Testar fluxo completo