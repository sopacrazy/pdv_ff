import type { CapacitorConfig } from '@capacitor/cli';

// O app roda o front (dist/) embutido no APK, mas todo o backend (API, SQLite, sync Protheus)
// continua só no PC do caixa — o tablet fala com ele pela rede local. Por isso não usamos
// `server.url` fixo aqui: o IP do servidor é configurado dentro do app (ver src/services/apiBase.ts)
// e pode mudar sem precisar gerar um novo APK.
const config: CapacitorConfig = {
  appId: 'br.com.fortfruit.pdv',
  appName: 'PDV Fort Fruit',
  webDir: 'dist',
  android: {
    // O servidor do PC não tem HTTPS (é só a rede local da loja) — sem isso o Android bloqueia
    // as chamadas fetch('http://...') por padrão a partir da API 28.
    allowMixedContent: true,
  },
  plugins: {
    // Live update do bundle web (ver server/api.js rotas /api/app/*, e
    // src/services/atualizacaoApp.ts) — cobre qualquer mudança de código React sem precisar gerar
    // e reinstalar um novo .apk. `updateUrl` fica vazio aqui de propósito: o IP do servidor só é
    // conhecido em runtime (usuário configura na primeira abertura), então é definido
    // dinamicamente via setUpdateUrl() — daí precisar de allowModifyUrl.
    CapacitorUpdater: {
      autoUpdate: 'atBackground',
      allowModifyUrl: true,
      persistModifyUrl: true,
      periodCheckDelay: 3600,
    },
  },
};

export default config;
