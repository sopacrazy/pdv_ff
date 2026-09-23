#Include "TOTVS.CH"
#Include "RESTFUL.CH"

WSRESTFUL PDVFORTFRUIT DESCRIPTION "Bilhete PDV - SZ4/SZ5 e pedido sem efetivacao" SECURITY "MATA410" FORMAT APPLICATION_JSON
    WSMETHOD GET STATUS DESCRIPTION "Estado do servico" PATH "/PDVFORTFRUIT/status"
    WSMETHOD POST PEDIDO DESCRIPTION "Inclui bilhete e pedido pendentes de efetivacao" PATH "/PDVFORTFRUIT/pedido"
END WSRESTFUL

WSMETHOD GET STATUS WSSERVICE PDVFORTFRUIT
    Local oRet := JsonObject():New()
    oRet["servico"] := "PDVFORTFRUIT"
    oRet["versao"] := "1.0.0"
    oRet["etapa"] := "SZ4_SZ5_SC5_SC6_SEM_EFETIVACAO"
    oRet["empresa"] := FWCodEmp()
    oRet["filial"] := FWCodFil()
    ::SetContentType("application/json")
    ::SetResponse(oRet:ToJson())
Return .T.

WSMETHOD POST PEDIDO WSSERVICE PDVFORTFRUIT
    Local cBody := ::GetContent()
    Local oJson := JsonObject():New()
    Local uParse, oRet
    If Empty(cBody) .Or. Len(cBody) > 262144
        SetRestFault(400,"Enviar objeto JSON de ate 256 KiB.")
        Return .F.
    EndIf
    If Left(AllTrim(cBody),1) != "{"
        SetRestFault(400,"O corpo deve ser objeto JSON.")
        Return .F.
    EndIf
    uParse := oJson:FromJson(cBody)
    If ValType(uParse) == "C"
        SetRestFault(400,"JSON invalido.")
        Return .F.
    EndIf
    oRet := U_PDVFTPed(oJson,cBody)
    If !oRet["sucesso"]
        SetRestFault(oRet["httpStatus"],oRet["erro"])
        Return .F.
    EndIf
    ::SetStatus(oRet["httpStatus"])
    ::SetContentType("application/json")
    ::SetResponse(oRet:ToJson())
Return .T.
