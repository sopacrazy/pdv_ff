# PDV Fort Fruit 0.1.16

- Corrige a primeira abertura em uma máquina sem configuração do Protheus.
- Permite importar o arquivo `.env` já configurado na máquina principal, antes de iniciar o servidor.
- Valida os campos obrigatórios e informa o que falta sem exibir senhas.
- Instalações já configuradas continuam abrindo diretamente.
- Mantém todas as correções de integração e atualização da versão 0.1.15.

A configuração do Protheus passa a ficar em `%APPDATA%\react-example\config\.env`. O instalador preserva o cadastro de uma instalação anterior; não inclui senhas nem bancos de dados. As vendas e os usuários existentes são mantidos.

Finalize ou cancele o cupom aberto antes de instalar. Na máquina nova, selecione **Importar configuração** e escolha o `.env` transferido localmente da máquina principal. Nas máquinas configuradas, use **Ajuda → Verificar atualizações agora**.

Validação: 76 testes locais, verificação TypeScript e build. Nenhuma venda de teste enviada ao Protheus durante a preparação desta versão.
