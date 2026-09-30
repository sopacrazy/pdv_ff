; Preserva o .env legado ANTES de o instalador remover a versão anterior.
; As versões novas não transportam credenciais dentro de resources/.
!macro customInit
  Push $0
  SetShellVarContext current
  ${IfNot} ${FileExists} "$APPDATA\react-example\config\.env"
    ReadRegStr $0 HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"
    ${If} $0 == ""
      ReadRegStr $0 HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation"
    ${EndIf}
    ${If} ${FileExists} "$0\resources\.env"
      CreateDirectory "$APPDATA\react-example\config"
      ClearErrors
      CopyFiles /SILENT "$0\resources\.env" "$APPDATA\react-example\config\.env"
      ${If} ${Errors}
        MessageBox MB_OK|MB_ICONSTOP "Nao foi possivel preservar a configuracao do PDV. A atualizacao foi interrompida."
        Abort
      ${EndIf}
    ${EndIf}
  ${EndIf}
  ${If} $installMode == "all"
    SetShellVarContext all
  ${EndIf}
  Pop $0
!macroend
