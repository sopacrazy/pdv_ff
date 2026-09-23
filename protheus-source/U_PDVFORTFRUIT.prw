#Include "TOTVS.CH"

/* Base funcional: RFATA03.PRW, FATA03I e FFT03EF.
   Etapa autorizada: SZ4/SZ5 + MATA410. SEM efetivacao/liberacao.
   Requer ambiente REST preparado e dicionario descrito em README-PDVBIL.md.
   Nao chamar RFATA03, FFT03EF, DelPV, ZeraB2 ou MaPvlNfs aqui.
*/
User Function PDVFTPed(oJson, cBody)
    Local aArea := GetArea()
    Local aAreas := {}
    Local aAliases := {"SZ4","SZ5","SC5","SC6","SC9","SA1","SA3","SB1","SE4","SF4","NNR","DA0","DA1","SF2","SD2","SE1"}
    Local oRet := JsonObject():New()
    Local bOldError := ErrorBlock({|e| Break(e)})
    Local uError, cErro := "", cNum := "", cId := "", cHash := ""
    Local aBil := {}, aRows := {}, aCab := {}, aItens := {}
    Local nHttp := 422, nI := 0
    Local lLock := .F., lReserva := .F., lGravou := .F., lExiste := .F.
    Local dOldDate := dDataBase
    Private lMsErroAuto := .F.
    Private lMsHelpAuto := .T.
    Private lAutoErrNoFile := .T.

    Default cBody := ""
    oRet["sucesso"] := .F.
    Begin Sequence
        For nI := 1 To Len(aAliases)
            If Select(aAliases[nI]) == 0
                nHttp := 503
                Break("Ambiente REST sem tabela " + aAliases[nI])
            EndIf
            AAdd(aAreas,(aAliases[nI])->(GetArea()))
            If !Empty((aAliases[nI])->(DbFilter()))
                Break("Ambiente REST deve abrir tabelas sem filtros: "+aAliases[nI])
            EndIf
        Next
        PdvField("SZ4","Z4_XPDVID","C",36)
        PdvField("SZ4","Z4_XPDVHS","C",32)
        cId := PdvText(oJson,"idVendaPdv",36,.T.)
        If PdvText(oJson,"empresa",8,.T.) != AllTrim(FWCodEmp()) .Or. ;
           PdvText(oJson,"filial",8,.T.) != AllTrim(FWCodFil())
            Break("Empresa/filial diferentes do ambiente REST autenticado.")
        EndIf
        If Empty(cBody)
            cBody := oJson:ToJson()
        EndIf
        cHash := MD5(cBody)
        lLock := LockByName("PDVBIL",.T.,.T.)
        If !lLock
            nHttp := 409
            Break("Outra inclusao PDV em andamento. Reenvie o mesmo JSON depois.")
        EndIf
        // Busca sem assumir numero de indice customizado. Otimizar com SIX na implantacao.
        SZ4->(DbGoTop())
        While !SZ4->(Eof())
            If !SZ4->(Deleted()) .And. SZ4->Z4_FILIAL == xFilial("SZ4") .And. ;
               AllTrim(SZ4->Z4_XPDVID) == cId
                lExiste := .T.
                cNum := SZ4->Z4_BILHETE
                If AllTrim(SZ4->Z4_XPDVHS) != cHash
                    nHttp := 409
                    Break("idVendaPdv ja utilizado com outro corpo JSON.")
                EndIf
                SC5->(DbSetOrder(1))
                If !SC5->(DbSeek(xFilial("SC5")+cNum))
                    nHttp := 409
                    Break("Bilhete existente sem pedido. Reconciliar; nao reincluir.")
                EndIf
                nHttp := 409
                PdvCheck(cNum,.F.)
                Exit
            EndIf
            SZ4->(DbSkip())
        EndDo
        If !lExiste
            PdvBuild(oJson,@aBil,@aRows,@aCab,@aItens)
            // Mesma dependencia de numeracao do RFATA03; homologar SX8/U_SZ4Seq.
            cNum := U_SZ4Seq()
            lReserva := .T.
            If ValType(cNum) != "C"
                Break("Sequenciador SZ4 nao retornou texto.")
            EndIf
            If Empty(cNum) .Or. Len(cNum) > TamSX3("Z4_BILHETE")[1] .Or. Len(cNum) > TamSX3("C5_NUM")[1]
                Break("Numero de bilhete invalido ou incompativel com SC5.")
            EndIf
            PdvNoDup(cNum)
            AAdd(aBil,{"Z4_BILHETE",cNum})
            AAdd(aBil,{"Z4_XPDVID",cId})
            AAdd(aBil,{"Z4_XPDVHS",cHash})
            AAdd(aCab,Nil)
            AIns(aCab,1)
            aCab[1] := {"C5_NUM",cNum,Nil}
            dDataBase := StoD(oJson["data"])
            // Catch dentro da transacao para desfazer SZ4/SZ5 e o ExecAuto juntos.
            Begin Transaction
                Begin Sequence
                    PdvWrite("SZ4",aBil)
                    For nI := 1 To Len(aRows)
                        AAdd(aRows[nI],{"Z5_BILHETE",cNum})
                        PdvWrite("SZ5",aRows[nI])
                    Next
                    lMsErroAuto := .F.
                    MSExecAuto({|a,b,c| MATA410(a,b,c)},aCab,aItens,3)
                    If lMsErroAuto
                        Break(PdvLog())
                    EndIf
                    SC5->(DbSetOrder(1))
                    If !SC5->(DbSeek(xFilial("SC5")+cNum))
                        Break("Pedido nao localizado apos MATA410.")
                    EndIf
                    PdvCheck(cNum,.T.)
                    lGravou := .T.
                Recover Using uError
                    cErro := PdvError(uError)
                    DisarmTransaction()
                    lGravou := .F.
                End Sequence
            End Transaction
            If !lGravou
                Break(cErro)
            EndIf
            ConfirmSX8()
            lReserva := .F.
        EndIf
        oRet["sucesso"] := .T.
        oRet["bilhete"] := AllTrim(cNum)
        oRet["pedido"] := AllTrim(cNum)
        oRet["idVendaPdv"] := cId
        oRet["etapa"] := "BILHETE_E_PEDIDO_GRAVADOS"
        oRet["reenvio"] := lExiste
        oRet["httpStatus"] := IIf(lExiste,200,201)
    Recover Using uError
        oRet["erro"] := PdvError(uError)
        oRet["httpStatus"] := nHttp
        If lGravou
            // Falha depois do commit: nao reciclar numero nem afirmar rollback.
            lReserva := .F.
            oRet["erro"] := "Gravacao realizada; falha na finalizacao. Reenvie o mesmo JSON para reconciliar."
            oRet["httpStatus"] := 500
        EndIf
    End Sequence
    If lReserva
        RollBackSX8()
    EndIf
    If lLock
        UnlockByName("PDVBIL",.T.,.T.)
    EndIf
    dDataBase := dOldDate
    For nI := Len(aAreas) To 1 Step -1
        RestArea(aAreas[nI])
    Next
    RestArea(aArea)
    ErrorBlock(bOldError)
Return oRet

Static Function PdvBuild(oJson,aBil,aRows,aCab,aItens)
    Local cCli := PdvText(oJson,"cliente",TamSX3("A1_COD")[1],.T.)
    Local cLoja := PdvText(oJson,"loja",TamSX3("A1_LOJA")[1],.T.)
    Local cVend := PdvText(oJson,"vendedor",TamSX3("A3_COD")[1],.T.)
    Local cCond := PdvText(oJson,"condicaoPagamento",TamSX3("E4_CODIGO")[1],.T.)
    Local cLocal := PdvText(oJson,"armazem",TamSX3("NNR_CODIGO")[1],.T.)
    Local cTab := PdvText(oJson,"tabelaPreco",TamSX3("DA0_CODTAB")[1],.T.)
    Local cData := PdvText(oJson,"data",8,.T.), dVenda := StoD(cData)
    Local cObs := PdvText(oJson,"observacao",TamSX3("Z4_OBS")[1],.F.)
    Local cTes := AllTrim(GetNewPar("MV_PDVTS",""))
    Local aInput := oJson["itens"], oItem
    Local cProd,cItem,cLote,cNumLote,cValidade,cCf,nI,nQtd,nPreco,nTotal,nQtd2,nPreco2
    Local nSoma := 0
    Local cNome,cNomVen,cDesCond,cNaturez,cTipoCli
    Local cEspecial := AllTrim(GetNewPar("FF_BASQUET",""))
    If Len(cData) != 8 .Or. Empty(dVenda) .Or. DtoS(dVenda) != cData
        Break("data deve ser valida no formato AAAAMMDD.")
    EndIf
    If dVenda > Date() .Or. dVenda <= GetMV("MV_ULMES") .Or. ;
       dVenda < GetNewPar("FF_DTFCHAE",StoD("19000101")) .Or. ;
       dVenda < GetNewPar("MV_DBLQMOV",StoD("19000101")) .Or. ;
       dVenda < GetNewPar("MV_DATAFIS",StoD("19000101"))
        Break("Data futura ou bloqueada por fechamento.")
    EndIf
    If ValType(aInput) != "A"
        Break("itens deve ser um array.")
    EndIf
    If Len(aInput) < 1 .Or. Len(aInput) > 99
        Break("Enviar de 1 a 99 itens, limite do fluxo RFATA03.")
    EndIf
    If Left(cCond,1) == "9"
        Break("Operacao especial: bonificacao/quebra/doacao fora do contrato PDV.")
    EndIf
    cCli := PadR(cCli,TamSX3("A1_COD")[1])
    cLoja := PadR(cLoja,TamSX3("A1_LOJA")[1])
    PdvSeek("SA1",cCli+cLoja)
    If SA1->A1_MSBLQL == "1"
        Break("Cliente bloqueado.")
    EndIf
    If AllTrim(SA1->A1_TABELA) != cTab
        Break("Tabela diferente da tabela do cliente usada no RFATA03.")
    EndIf
    cNome := SA1->A1_NOME
    cNaturez := SA1->A1_NATUREZ
    cTipoCli := SA1->A1_TIPO
    cVend := PadR(cVend,TamSX3("A3_COD")[1])
    PdvSeek("SA3",cVend)
    If SA3->A3_MSBLQL == "1"
        Break("Vendedor bloqueado.")
    EndIf
    cNomVen := SA3->A3_NOME
    cCond := PadR(cCond,TamSX3("E4_CODIGO")[1])
    PdvSeek("SE4",cCond)
    cDesCond := SE4->E4_DESCRI
    cLocal := PadR(cLocal,TamSX3("NNR_CODIGO")[1])
    PdvSeek("NNR",cLocal)
    cTab := PadR(cTab,TamSX3("DA0_CODTAB")[1])
    PdvSeek("DA0",cTab)
    If DA0->DA0_ATIVO == "2" .Or. DA0->DA0_DATATE < dVenda .Or. DA0->DA0_DATDE > dVenda
        Break("Tabela inativa ou fora da vigencia.")
    EndIf
    If Empty(cTes)
        Break("Configurar MV_PDVTS com a TES de venda homologada.")
    EndIf
    PdvSeek("SF4",PadR(cTes,TamSX3("F4_CODIGO")[1]))
    cCf := SF4->F4_CF
    If AllTrim(SA1->A1_EST) != AllTrim(GetMV("MV_ESTADO"))
        cCf := "6"+SubStr(cCf,2,3)
    EndIf
    For nI := 1 To Len(aInput)
        oItem := aInput[nI]
        If ValType(oItem) != "J" .And. ValType(oItem) != "O"
            Break("Cada item deve ser objeto JSON.")
        EndIf
        cProd := PadR(PdvText(oItem,"produto",TamSX3("B1_COD")[1],.T.),TamSX3("B1_COD")[1])
        PdvSeek("SB1",cProd)
        If SB1->B1_MSBLQL == "1"
            Break("Produto bloqueado: "+AllTrim(cProd))
        EndIf
        If SB1->B1_TIPO == "MC" .Or. (!Empty(cEspecial) .And. AllTrim(cProd) $ cEspecial)
            Break("Produto com operacao especial: usar RFATA03.")
        EndIf
        nQtd := PdvNum(oItem,"quantidade")
        nPreco := PdvNum(oItem,"valorUnitario")
        nTotal := PdvNum(oItem,"valorTotal")
        If nQtd <= 0 .Or. nPreco <= 0.10 .Or. nTotal <= 0
            Break("Quantidade/valor invalido ou operacao especial (preco <= 0.10).")
        EndIf
        If Abs(Round(nQtd*nPreco,2)-nTotal) > 0.009
            Break("Total do item difere de quantidade x preco liquido.")
        EndIf
        nQtd2 := nQtd
        If !Empty(SB1->B1_SEGUM)
            If SB1->B1_CONV <= 0
                Break("Fator de conversao invalido: "+AllTrim(cProd))
            EndIf
            If SB1->B1_TIPCONV == "D"
                nQtd2 := nQtd/SB1->B1_CONV
            ElseIf SB1->B1_TIPCONV == "M"
                nQtd2 := nQtd*SB1->B1_CONV
            Else
                Break("Tipo de conversao de unidade desconhecido.")
            EndIf
        EndIf
        nQtd2 := Round(nQtd2,TamSX3("Z5_UNSVEN")[2])
        If nQtd2 <= 0
            Break("Quantidade na segunda unidade arredondou para zero.")
        EndIf
        nPreco2 := Round(nTotal/nQtd2,6)
        PdvSeek("DA1",cTab+cProd)
        If nPreco < DA1->DA1_PRCVEN .Or. nPreco2 < DA1->DA1_PRC2UM
            Break("Preco inferior a tabela do cliente: "+AllTrim(cProd))
        EndIf
        cLote := PdvText(oItem,"lote",TamSX3("Z5_LOTECTL")[1],.F.)
        cNumLote := PdvText(oItem,"sublote",TamSX3("Z5_NUMLOTE")[1],.F.)
        cValidade := PdvText(oItem,"validade",8,.F.)
        If !Empty(cValidade)
            If Empty(StoD(cValidade)) .Or. DtoS(StoD(cValidade)) != cValidade
                Break("Validade invalida; usar AAAAMMDD.")
            EndIf
        EndIf
        If Rastro(cProd,"L") .And. Empty(cLote)
            Break("Produto exige lote: "+AllTrim(cProd))
        EndIf
        cItem := StrZero(nI,4)
        AAdd(aRows,{{"Z5_FILIAL",xFilial("SZ5")},{"Z5_CLIENTE",cCli},{"Z5_LOJA",cLoja},;
            {"Z5_DATA",dVenda},{"Z5_ITEM",cItem},{"Z5_CODPRO",cProd},{"Z5_DESPRO",SB1->B1_DESC},;
            {"Z5_QTDE",nQtd},{"Z5_PRECO",nPreco},{"Z5_TOTAL",nTotal},;
            {"Z5_UM",SB1->B1_UM},{"Z5_SEGUM",SB1->B1_SEGUM},{"Z5_UNSVEN",nQtd2},;
            {"Z5_PRECO2",nPreco2},{"Z5_LOTECTL",cLote},{"Z5_NUMLOTE",cNumLote},{"Z5_DTVALID",StoD(cValidade)}})
        AAdd(aItens,{{"C6_ITEM",StrZero(nI,2),Nil},{"C6_PRODUTO",cProd,Nil},;
            {"C6_QTDVEN",nQtd,Nil},{"C6_PRCVEN",nPreco,Nil},{"C6_PRUNIT",nPreco,Nil},;
            {"C6_VALOR",nTotal,Nil},{"C6_TES",cTes,Nil},{"C6_CF",cCf,Nil},;
            {"C6_LOCAL",cLocal,Nil},{"C6_ENTREG",dVenda,Nil},{"C6_UM",SB1->B1_UM,Nil},;
            {"C6_SEGUM",SB1->B1_SEGUM,Nil},{"C6_UNSVEN",nQtd2,Nil},{"C6_PRSEGUM",nPreco2,Nil},;
            {"C6_LOTECTL",cLote,Nil},{"C6_NUMLOTE",cNumLote,Nil},{"C6_DTVALID",StoD(cValidade),Nil}})
        nSoma += nTotal
    Next
    If Abs(Round(nSoma,2)-PdvNum(oJson,"total")) > 0.009
        Break("Total da venda difere da soma dos itens.")
    EndIf
    aBil := {{"Z4_FILIAL",xFilial("SZ4")},{"Z4_DATA",dVenda},{"Z4_CLIENTE",cCli},;
        {"Z4_LOJA",cLoja},{"Z4_NOMCLI",cNome},{"Z4_COND",cCond},{"Z4_DESCOND",cDesCond},;
        {"Z4_VEND",cVend},{"Z4_NOMVEN",cNomVen},{"Z4_LOCAL",cLocal},{"Z4_NATUREZ",cNaturez},;
        {"Z4_ENTREGA",dVenda},{"Z4_TOTBIL",Round(nSoma,2)},{"Z4_OBS",cObs},;
        {"Z4_ORIGEM","PDV"},{"Z4_USUARIO",RetCodUsr()},{"Z4_DATPROC",StoD("")}}
    If SZ4->(FieldPos("Z4_TABELA")) > 0
        AAdd(aBil,{"Z4_TABELA",cTab})
    EndIf
    aCab := {{"C5_TIPO","N",Nil},{"C5_CLIENTE",cCli,Nil},{"C5_LOJACLI",cLoja,Nil},;
        {"C5_LOJAENT",cLoja,Nil},{"C5_EMISSAO",dVenda,Nil},{"C5_CONDPAG",cCond,Nil},;
        {"C5_TABELA",cTab,Nil},{"C5_VEND1",cVend,Nil},{"C5_TIPOCLI",cTipoCli,Nil},;
        {"C5_MOEDA",1,Nil},{"C5_TPFRETE","S",Nil}}
Return Nil

Static Function PdvSeek(cAlias,cKey)
    (cAlias)->(DbSetOrder(1))
    If !(cAlias)->(DbSeek(xFilial(cAlias)+cKey))
        Break("Cadastro nao encontrado em "+cAlias+": "+AllTrim(cKey))
    EndIf
Return Nil

Static Function PdvNoDup(cNum)
    Local aAliases := {"SZ4","SZ5","SC5","SC6","SC9"}, nI
    For nI := 1 To Len(aAliases)
        (aAliases[nI])->(DbSetOrder(1))
        If (aAliases[nI])->(DbSeek(xFilial(aAliases[nI])+cNum))
            Break("Numero ja utilizado em "+aAliases[nI]+". Revisar sequenciador.")
        EndIf
    Next
    SF2->(DbSetOrder(1))
    SD2->(DbSetOrder(3))
    SE1->(DbSetOrder(1))
    If SF2->(DbSeek(xFilial("SF2")+PadR(cNum,TamSX3("F2_DOC")[1]))) .Or. ;
       SD2->(DbSeek(xFilial("SD2")+PadR(cNum,TamSX3("D2_DOC")[1]))) .Or. ;
       SE1->(DbSeek(xFilial("SE1")+"BIL"+PadR(cNum,TamSX3("E1_NUM")[1])))
        Break("Numero ja utilizado em documento/financeiro. Revisar sequenciador.")
    EndIf
Return Nil

Static Function PdvCheck(cNum,lNovo)
    Local nBil := 0, nPv := 0, nTotBil := 0, nTotPv := 0
    SZ5->(DbSetOrder(1))
    SZ5->(DbSeek(xFilial("SZ5")+cNum))
    While !SZ5->(Eof()) .And. SZ5->Z5_FILIAL == xFilial("SZ5") .And. SZ5->Z5_BILHETE == cNum
        If !SZ5->(Deleted())
            nBil++
            nTotBil += SZ5->Z5_TOTAL
        EndIf
        SZ5->(DbSkip())
    EndDo
    SC6->(DbSetOrder(1))
    SC6->(DbSeek(xFilial("SC6")+cNum))
    While !SC6->(Eof()) .And. SC6->C6_FILIAL == xFilial("SC6") .And. SC6->C6_NUM == cNum
        If !SC6->(Deleted())
            nPv++
            nTotPv += SC6->C6_VALOR
        EndIf
        SC6->(DbSkip())
    EndDo
    If nBil == 0 .Or. nBil != nPv .Or. Abs(nTotBil-nTotPv) > 0.009
        Break("Divergencia entre itens/total do bilhete e pedido. Reconciliar.")
    EndIf
    If lNovo
        SC9->(DbSetOrder(1))
        If SC9->(DbSeek(xFilial("SC9")+cNum)) .Or. !Empty(SC5->C5_NOTA)
            Break("Ponto de entrada liberou/faturou o pedido. Homologar fluxo sem efetivacao.")
        EndIf
    EndIf
Return Nil

Static Function PdvWrite(cAlias,aFields)
    Local nI,nPos,uValue,aStruct := (cAlias)->(DbStruct())
    // RecLock nao executa validacoes de tela SX3: esta entrada tem contrato fechado.
    For nI := 1 To Len(aFields)
        nPos := (cAlias)->(FieldPos(aFields[nI,1]))
        If nPos == 0
            Break("Campo obrigatorio ausente: "+aFields[nI,1])
        EndIf
        uValue := aFields[nI,2]
        If ValType(uValue) != aStruct[nPos,2]
            Break("Tipo incompativel: "+aFields[nI,1])
        EndIf
        If ValType(uValue) == "C"
            If Len(RTrim(uValue)) > aStruct[nPos,3]
                Break("Valor excede tamanho: "+aFields[nI,1])
            EndIf
        ElseIf ValType(uValue) == "N"
            If "*" $ Str(uValue,aStruct[nPos,3],aStruct[nPos,4])
                Break("Valor excede capacidade numerica: "+aFields[nI,1])
            EndIf
            If Abs(Round(uValue,aStruct[nPos,4])-uValue) > 0.0000001
                Break("Precisao excede dicionario: "+aFields[nI,1])
            EndIf
        EndIf
    Next
    If !RecLock(cAlias,.T.)
        Break("Falha no bloqueio de inclusao em "+cAlias)
    EndIf
    For nI := 1 To Len(aFields)
        (cAlias)->(FieldPut(FieldPos(aFields[nI,1]),aFields[nI,2]))
    Next
    (cAlias)->(MsUnlock())
Return Nil

Static Function PdvField(cAlias,cField,cType,nSize)
    Local nPos := (cAlias)->(FieldPos(cField)), aStruct := (cAlias)->(DbStruct())
    If nPos == 0
        Break("Preparar dicionario: campo ausente "+cField)
    EndIf
    If aStruct[nPos,2] != cType .Or. aStruct[nPos,3] < nSize
        Break("Preparar dicionario: tipo/tamanho incorreto em "+cField)
    EndIf
Return Nil

Static Function PdvText(oJson,cKey,nMax,lRequired)
    Local uValue := oJson[cKey]
    If ValType(uValue) == "U" .And. !lRequired
        Return ""
    EndIf
    If ValType(uValue) != "C"
        Break("Campo deve ser texto: "+cKey)
    EndIf
    If Len(uValue) > nMax .Or. (lRequired .And. Empty(uValue))
        Break("Campo vazio ou acima do tamanho: "+cKey)
    EndIf
Return AllTrim(uValue)

Static Function PdvNum(oJson,cKey)
    Local uValue := oJson[cKey]
    If ValType(uValue) != "N"
        Break("Campo deve ser numerico: "+cKey)
    EndIf
Return uValue

Static Function PdvLog()
    Local aLog := GetAutoGRLog(), cLog := "MATA410 rejeitou o pedido.", nI
    For nI := 1 To Len(aLog)
        cLog += Chr(10)+aLog[nI]
    Next
Return cLog

Static Function PdvError(uError)
    If ValType(uError) == "C"
        Return uError
    EndIf
    If ValType(uError) == "O"
        ConOut("PDVBIL: "+uError:Description)
        Return "Erro AdvPL na inclusao. Consultar log PDVBIL no AppServer."
    EndIf
Return "Falha na inclusao do bilhete PDV."
