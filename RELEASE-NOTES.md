# PDV Fort Fruit 0.1.23

- Mostra **Preço 2ª UM** com seis casas decimais nos itens da venda em andamento e em **Consultas**, calculado a partir do total arredondado da linha e da quantidade na segunda unidade.
- Permite conferir valores como R$ 16,82 ÷ 1,21 = 13,900826, como no bilhete do Protheus.
- Novas vendas de produtos KG arredondam o total do item para cima quando o arredondamento comum ficaria abaixo do preço mínimo por peso; o valor aparece antes do pagamento.
- Em uma venda PDV rejeitada, o botão **Ajustar +1 centavo** permite corrigir esse caso depois de confirmar que o novo total foi cobrado. O histórico registra usuário, item e totais. O reenvio continua manual.

Finalize ou cancele o cupom aberto antes de instalar. Se houver rejeição por preço abaixo da tabela para um peso correto, confira o total cobrado antes de ajustar e reenviar. Preços da tabela alterados ou diferenças maiores continuam exigindo conferência do cadastro.

Validação: testes do cálculo e do payload com os itens do exemplo, verificação TypeScript, build do frontend e conferência do instalador. Nenhuma venda real enviada ao Protheus durante a preparação desta versão.

## Alterações mantidas da versão 0.1.22

- Em **Consultas**, permite corrigir a quantidade de itens de uma venda PDV rejeitada pelo Protheus.
- Recalcula o item e o total, mostra o histórico da alteração com usuário e mantém a venda rejeitada até o reenvio manual.
- Bloqueia edição de vendas integradas, em envio ou sem rejeição confirmada. A correção deve refletir a quantidade realmente vendida e o valor cobrado.

Após instalar, expanda a venda rejeitada em **Consultas**, clique no lápis ao lado da quantidade, confira o novo total, salve e use o botão de reenvio. O retorno de preço abaixo da tabela pode exigir correção do cadastro do produto se a quantidade original estiver correta.

Validação: testes locais, verificação TypeScript, build do frontend e conferência do instalador. Nenhuma venda real enviada ao Protheus durante a preparação desta versão.

## Alterações mantidas da versão 0.1.21

- Corrige o total das novas vendas com itens fracionados: soma os valores já arredondados de cada linha, como no Protheus.
- Ao reenviar vendas PDV antigas ainda pendentes, corrige somente diferenças comprovadamente causadas por esse arredondamento e registra o total anterior no histórico da venda.
- Diferenças de outra origem continuam bloqueadas para conferência. As vendas pendentes seguem na fila automática.

Finalize ou cancele o cupom aberto antes de instalar. Na máquina com vendas pendentes, a fila tentará enviá-las ao Protheus após a atualização. Confira o resultado em **Consultas**.

Validação: testes locais, verificação TypeScript, build do frontend e conferência do instalador. Nenhuma venda real enviada ao Protheus durante a preparação desta versão.

## Alterações mantidas da versão 0.1.20

- Corrige o envio de vendas do **PDV** quando o cliente REST não informa `paymentForm`: esses campos deixam de ser exigidos e enviados no pedido PDV.
- Mantém o identificador das vendas pendentes e a fila automática de reenvio.
- A abertura do Electron tenta carregar a janela novamente após uma falha e mostra o erro se não conseguir, em vez de permanecer indefinidamente na tela inicial.
- O **Bilhete** mantém a forma de pagamento consultada em `A1_FORMA`.

Finalize ou cancele o cupom aberto antes de instalar. Na máquina com vendas pendentes, a fila tentará enviá-las ao Protheus após a atualização. Os dados locais são preservados.

Validação: 88 testes locais, verificação TypeScript, build do frontend e conferência do instalador. Nenhuma venda real enviada ao Protheus durante a preparação desta versão.

## Alterações mantidas da versão 0.1.19

- O envio de vendas do **PDV** usa a forma de pagamento recebida pela API REST e deixa de depender da conexão SQL Server na porta 1433.
- O reenvio das vendas PDV pendentes também segue pela REST, preservando o identificador da venda.
- O fluxo de **Bilhete** mantém a consulta de `A1_FORMA` no SQL Server, pois esse dado pode divergir do cadastro REST.
- Mantém as correções das versões anteriores.

Finalize ou cancele o cupom aberto antes de instalar. Use **Ajuda → Verificar atualizações agora** nas máquinas configuradas. As vendas pendentes no PDV serão retomadas pela fila de envio.

Validação: 88 testes locais, verificação TypeScript, build do frontend e conferência do instalador. Nenhuma venda real enviada ao Protheus durante a preparação desta versão.

## Alterações mantidas da versão 0.1.18

- Em **Consultas**, permite escolher **Período** e informar data inicial e final para buscar vendas de vários dias.
- Mostra a data de cada venda no resultado e atualiza os totais conforme o período escolhido.
- Mantém **Dia de operação** como consulta padrão, com atualização automática dos resultados.
- Valida o intervalo de datas e mantém as correções das versões anteriores.

Finalize ou cancele o cupom aberto antes de instalar. Use **Ajuda → Verificar atualizações agora** nas máquinas configuradas. O instalador preserva configurações, usuários e vendas.

Validação: 87 testes locais, verificação TypeScript, build do frontend e conferência do instalador. Nenhuma venda enviada ao Protheus durante a preparação desta versão.

## Alterações mantidas da versão 0.1.17

- Confere exclusões no Protheus ao iniciar e a cada cinco minutos, incluindo os registros com `D_E_L_E_T_='*'`.
- Permite conferir imediatamente pelo botão **Conferir exclusões**, em Consultas.
- Marca o bilhete como **Excluído no Protheus**, retira dos totais e bloqueia reenvio, preservando o histórico.
- Exige correspondência de filial, bilhete e ID da integração. Ausência de registro ou falha de conexão não cancela a venda local.
- Atualiza a situação se o mesmo bilhete for restaurado no Protheus, sem enviar uma nova venda.
- Preserva a configuração e todas as correções das versões anteriores.

Finalize ou cancele o cupom aberto antes de instalar. Use **Ajuda → Verificar atualizações agora** nas máquinas configuradas. O instalador preserva configurações, usuários e vendas. Na primeira abertura de uma máquina nova, importe o `.env` configurado, transferido localmente da máquina principal.

Validação: 85 testes locais, verificação TypeScript e build. As consultas de conferência usam somente SELECT. Nenhuma venda de teste enviada ao Protheus.

## Alterações mantidas da versão 0.1.16

- Corrige a primeira abertura em uma máquina sem configuração do Protheus.
- Permite importar o arquivo `.env` já configurado na máquina principal, antes de iniciar o servidor.
- Valida os campos obrigatórios e informa o que falta sem exibir senhas.
- Instalações já configuradas continuam abrindo diretamente.
- Mantém todas as correções de integração e atualização da versão 0.1.15.

A configuração do Protheus passa a ficar em `%APPDATA%\react-example\config\.env`. O instalador preserva o cadastro de uma instalação anterior; não inclui senhas nem bancos de dados. As vendas e os usuários existentes são mantidos.

Finalize ou cancele o cupom aberto antes de instalar. Na máquina nova, selecione **Importar configuração** e escolha o `.env` transferido localmente da máquina principal. Nas máquinas configuradas, use **Ajuda → Verificar atualizações agora**.

Validação: 76 testes locais, verificação TypeScript e build. Nenhuma venda de teste enviada ao Protheus durante a preparação desta versão.
