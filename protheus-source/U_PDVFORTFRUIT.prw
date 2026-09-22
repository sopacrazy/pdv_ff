#Include "TOTVS.CH"

/*
================================================================================
 PDVFTPED — Cria um Pedido de Venda no Protheus via MSExecAuto (MATA410),
 a partir de uma venda feita no PDV Fort Fruit.

 POR QUE ESSE ARQUIVO EXISTE
 ----------------------------
 A integracao original tentada foi contra o endpoint REST de terceiros
 "4SALFORTFRUITORDERS" (do produto "Portal 4Sales"), mas o contrato exato
 (nomes de campo, JSON esperado) nao e documentado e nao conseguimos
 descobrir por engenharia reversa, mesmo com acesso ao ambiente de teste
 e a um payload real capturado do portal em producao.

 Em vez de depender de um endpoint de terceiros sem documentacao, este
 arquivo cria NOSSA PROPRIA rotina, usando o MSExecAuto do MATA410 — que
 e a API OFICIAL e documentada da TOTVS para criacao programatica de
 Pedido de Venda. O contrato do JSON abaixo e definido por nos.

 REFERENCIA USADA
 -----------------
 A estrutura dos arrays aCabPV/aItemPV e a chamada ao MSExecAuto foram
 copiadas do padrao ja usado em RFATA03.PRW (rotina de Bilhetes da Fort
 Fruit), funcao FFT03EF, que ja faz exatamente isso (efetivar um Bilhete
 como Pedido de Venda via MATA410). Aqui simplificamos removendo tudo que
 e especifico do fluxo de Bilhete (tabela SZ4/SZ5), recebendo os dados
 direto do JSON.

 O QUE PRECISA SER CONFIRMADO PELO TIME PROTHEUS ANTES DE USAR EM PRODUCAO
 ---------------------------------------------------------------------------
 Toda linha com "// CONFIRMAR:" abaixo e um valor que copiei de RFATA03.PRW
 como palpite razoavel, mas que pode estar errado pro contexto do PDV
 (loja fisica) — o RFATA03.PRW foi feito pro fluxo de "Bilhete" (venda por
 rota/representante), que pode ter regras fiscais diferentes do PDV.
 Preciso que alguem que conhece a configuracao fiscal da Fort Fruit no
 Protheus confirme especialmente:
   - Empresa/filial correta pro PDV (estou assumindo "14"/"01" — Castanhal,
     porque foi o que apareceu no restante do fonte, mas isso PRECISA ser
     confirmado)
   - Codigo da TES de venda normal (estou usando "510", copiado do
     RFATA03.PRW)
   - Codigo da tabela de preco e condicao de pagamento padrao do PDV

 COMO ISSO DEVE SER EXPOSTO VIA REST
 -------------------------------------
 Este arquivo so tem a FUNCAO DE NEGOCIO (User Function PDVFTPed). Ele
 precisa ser chamado de dentro de um WSMETHOD POST — a forma exata de
 declarar esse WSRESTFUL varia conforme a versao/config do Protheus de
 voces, e voces ja tem exemplos funcionando (os endpoints /4SAL*, que
 usam Basic Auth e ja funcionam). O mais seguro e o time Protheus copiar
 a estrutura de UM DESSES arquivos existentes (o WSRESTFUL/WSMETHOD que
 registra "/4SALFORTFRUITORDERS", por exemplo) e so trocar a logica de
 dentro pra chamar U_PDVFTPed(oJson) — assim a autenticacao, tratamento
 de erro HTTP etc. ficam identicos ao que ja esta testado e funcionando.

 CONTRATO JSON ESPERADO (definido por nos, sem depender de terceiros)
 ------------------------------------------------------------------------
 {
   "cliente":            "YDOVT3",          // Codigo do cliente no Protheus (A1_COD)
   "loja":                "01",              // Loja do cliente (A1_LOJA)
   "vendedor":            "000012",          // Codigo do vendedor no Protheus (A3_COD)
   "condicaoPagamento":   "001",             // Codigo da condicao de pagamento (E4_CODIGO)   // CONFIRMAR
   "tabelaPreco":         "015",             // Codigo da tabela de preco (DA0_CODTAB)         // CONFIRMAR
   "numeroCupomPdv":      "000123",          // Numero do cupom do PDV, so pra rastreabilidade
   "observacao":          "Venda PDV Loja 01 - Cupom 000123",
   "itens": [
     { "produto": "115002", "quantidade": 1, "valorUnitario": 10.00 }
   ]
 }

 RETORNO
 -------
 Sucesso: { "sucesso": true, "pedido": "<numero do C5_NUM gerado>" }
 Erro:    { "sucesso": false, "erro": "<mensagem do MostraErro/AdvPL>" }

 SOBRE O PARAMETRO oJson
 ------------------------
 Assumi que quem chama esta funcao ja parseou o corpo da requisicao num
 objeto JsonObject (metodos GetJsonText/GetJsonNumeric/GetJsonObject —
 classe nativa do AdvPL). Se o WSMETHOD de voces usa outra forma de JSON
 (ex.: Hash via hb_JsonDecode, acessado como oJson["campo"]), so ajustar
 essas chamadas de leitura — a logica de negocio (ExecAuto) continua igual.
================================================================================
*/

// CONFIRMAR: empresa/filial corretos para o PDV. RFATA03.PRW usa muito
// FWCodEmp()=="14" .AND. FWCodFil()=="01" (Castanhal) como caso especial —
// mas isso deve ser confirmado, nao assumido.
#Define PDV_TES_VENDA        "510"   // CONFIRMAR: código da TES de venda normal
#Define PDV_MOEDA            1
#Define PDV_TIPO_LIBERACAO   "1"     // C5_TIPLIB
#Define PDV_LIBERADO         "S"     // C5_LIBEROK — pedido já liberado, sem passar por aprovação

User Function PDVFTPed(oJson)

	Local aCabPV      := {}
	Local aItemPV     := {}
	Local oItemJson   := Nil
	Local cCliente    := ""
	Local cLoja       := ""
	Local cVendedor   := ""
	Local cCondPag    := ""
	Local cTabela     := ""
	Local cObs        := ""
	Local cCfop       := ""
	Local nItem       := 0
	Local cNumPedido  := ""
	Local oResposta   := JsonObject():New()
	Local cErro       := ""

	Private lMsErroAuto := .F.   // Usada internamente pelo MSExecAuto

	If oJson == Nil
		oResposta["sucesso"] := .F.
		oResposta["erro"]    := "Corpo da requisicao vazio ou JSON invalido."
		Return oResposta
	EndIf

	cCliente  := AllTrim(oJson:GetJsonText("cliente"))
	cLoja     := AllTrim(oJson:GetJsonText("loja"))
	cVendedor := AllTrim(oJson:GetJsonText("vendedor"))
	cCondPag  := AllTrim(oJson:GetJsonText("condicaoPagamento"))
	cTabela   := AllTrim(oJson:GetJsonText("tabelaPreco"))
	cObs      := AllTrim(oJson:GetJsonText("observacao"))

	If Empty(cCliente) .Or. Empty(cLoja)
		oResposta["sucesso"] := .F.
		oResposta["erro"]    := "Campos 'cliente' e 'loja' sao obrigatorios."
		Return oResposta
	EndIf

	If oJson:GetJsonObject("itens") == Nil .Or. Len(oJson:GetJsonObject("itens")) == 0
		oResposta["sucesso"] := .F.
		oResposta["erro"]    := "Pedido sem itens."
		Return oResposta
	EndIf

	// Resolve CFOP a partir da TES (mesma logica do RFATA03.PRW: compara
	// estado do cliente com o estado da empresa pra saber se e' operacao
	// dentro do estado ou interestadual)
	SA1->(dbSetOrder(1))
	If !SA1->(dbSeek(xFilial("SA1") + cCliente + cLoja))
		oResposta["sucesso"] := .F.
		oResposta["erro"]    := "Cliente " + cCliente + "/" + cLoja + " nao encontrado no Protheus."
		Return oResposta
	EndIf

	SF4->(dbSetOrder(1))
	If SF4->(dbSeek(xFilial("SF4") + PDV_TES_VENDA))
		If AllTrim(SA1->A1_EST) == AllTrim(GetMV("MV_ESTADO"))
			cCfop := SF4->F4_CF
		Else
			cCfop := "6" + SubStr(SF4->F4_CF, 2, 3)
		EndIf
	Else
		cCfop := "5101"
	EndIf

	// Reserva o numero do pedido via SX8 (padrao AdvPL) — precisa confirmar
	// (ConfirmSX8) em caso de sucesso ou desfazer (RollBackSx8) em caso de
	// erro, senao o numero fica "queimado" sem uso.
	cNumPedido := GetSxeNum("SC5", "C5_NUM")

	// ARRAY DE CABECALHO DO PEDIDO (C5_*) — modelado em cima do que
	// RFATA03.PRW:FFT03EF monta pra gerar Pedido de Venda via ExecAuto.
	aCabPV := { ;
		{"C5_NUM"    , cNumPedido  , Nil}, ; // Numero do pedido (reservado via SX8)
		{"C5_CLIENTE", cCliente     , Nil}, ; // Codigo do cliente
		{"C5_LOJAENT", cLoja        , Nil}, ; // Loja para entrega
		{"C5_LOJACLI", cLoja        , Nil}, ; // Loja do cliente
		{"C5_EMISSAO", MsDate()     , Nil}, ; // Data de emissao
		{"C5_TABELA" , cTabela      , Nil}, ; // Tabela de preco               // CONFIRMAR
		{"C5_CONDPAG", cCondPag     , Nil}, ; // Condicao de pagamento         // CONFIRMAR
		{"C5_DESC1"  , 0            , Nil}, ; // Percentual de desconto
		{"C5_TIPLIB" , PDV_TIPO_LIBERACAO, Nil}, ;
		{"C5_MOEDA"  , PDV_MOEDA    , Nil}, ;
		{"C5_LIBEROK", PDV_LIBERADO , Nil}, ; // Ja libera o pedido direto
		{"C5_TIPOCLI", "R"          , Nil}, ; // Revendedor — mesmo default do RFATA03.PRW  // CONFIRMAR
		{"C5_VEND1"  , cVendedor    , Nil}, ; // Vendedor
		{"C5_TPFRETE", "S"          , Nil}, ; // Sem frete (venda balcao/PDV)
		{"C5_OBS"    , cObs         , Nil} ;
	}

	// ARRAY DE ITENS (C6_*)
	nItem := 0
	For Each oItemJson In oJson:GetJsonObject("itens")
		nItem++
		AAdd(aItemPV, { ;
			{"C6_ITEM"   , StrZero(nItem, 2)                          , Nil}, ;
			{"C6_PRODUTO", AllTrim(oItemJson:GetJsonText("produto"))  , Nil}, ;
			{"C6_QTDVEN" , oItemJson:GetJsonNumeric("quantidade")     , Nil}, ;
			{"C6_PRCVEN" , oItemJson:GetJsonNumeric("valorUnitario")  , Nil}, ;
			{"C6_PRUNIT" , oItemJson:GetJsonNumeric("valorUnitario")  , Nil}, ;
			{"C6_TES"    , PDV_TES_VENDA                              , Nil}, ;
			{"C6_CF"     , cCfop                                      , Nil}, ;
			{"C6_CLI"    , cCliente                                   , Nil}, ;
			{"C6_LOJA"   , cLoja                                      , Nil} ;
		})
	Next oItemJson

	If Len(aItemPV) == 0
		oResposta["sucesso"] := .F.
		oResposta["erro"]    := "Nenhum item valido encontrado no JSON."
		Return oResposta
	EndIf

	lMsErroAuto := .F.
	MSExecAuto({|x, y, z| Mata410(x, y, z)}, aCabPV, aItemPV, 3) // 3 = Inclusao

	If lMsErroAuto
		cErro := MostraErro()
		RollBackSx8()
		oResposta["sucesso"] := .F.
		oResposta["erro"]    := cErro
	Else
		ConfirmSX8()
		oResposta["sucesso"] := .T.
		oResposta["pedido"]  := AllTrim(cNumPedido)
	EndIf

	Return oResposta
