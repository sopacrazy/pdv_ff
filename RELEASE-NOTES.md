# PDV Fort Fruit 0.1.15

- Integração com o Protheus pela conta REST principal, preservando o vendedor do operador.
- Consultas e envio seguem o ambiente configurado no servidor.
- Forma de pagamento do bilhete obtida de A1_FORMA, mantendo a condição de A1_COND.
- Exibição do preço da segunda unidade conforme a tabela do cliente.
- Ajustes na busca de produtos e correção do código duplicado no PDV desktop.
- Atualização automática pelo repositório público, sem token embutido.
- Bundle de atualização dos tablets incluído no servidor Windows.

A configuração do Protheus passa a ficar em `%APPDATA%\react-example\config\.env`. O instalador preserva o cadastro de uma instalação anterior; não inclui senhas nem bancos de dados. As vendas e os usuários existentes são mantidos.

Finalize ou cancele o cupom aberto antes de instalar. Se a versão anterior não oferecer atualização no menu Ajuda, execute o instalador 0.1.15 uma vez. Depois, as próximas versões serão detectadas automaticamente.

Validação: 70 testes locais, verificação TypeScript e build. Nenhuma venda de teste enviada ao Protheus durante a preparação desta versão.
