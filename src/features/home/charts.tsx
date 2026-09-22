import { ReactNode, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';

// Paleta dos gráficos (slots 1 e 4 da paleta validada; trilhas são steps claros do mesmo tom).
export const COR_SERIE = '#2a78d6';
export const COR_SERIE_FRACA = '#86b6ef';
export const COR_TRILHA = '#e4eefb';
export const COR_DESTAQUE = '#eda100';
export const COR_TRILHA_DESTAQUE = '#fbeecd';

function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(0);

  useEffect(() => {
    const elemento = ref.current;
    if (!elemento) return;
    const observador = new ResizeObserver(([entrada]) => setLargura(entrada.contentRect.width));
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  return [ref, largura] as const;
}

interface DonutProps {
  percentual: number;
  cor: string;
  corTrilha: string;
  children: ReactNode;
}

export function Donut({ percentual, cor, corTrilha, children }: DonutProps) {
  const raio = 62;
  const circunferencia = 2 * Math.PI * raio;
  const fracao = Math.max(0, Math.min(percentual, 100)) / 100;

  return (
    <div className="relative w-[164px] h-[164px]">
      <svg viewBox="0 0 150 150" className="w-full h-full -rotate-90">
        <circle cx="75" cy="75" r={raio} fill="none" stroke={corTrilha} strokeWidth="15" />
        {fracao > 0 && (
          <circle
            cx="75"
            cy="75"
            r={raio}
            fill="none"
            stroke={cor}
            strokeWidth="15"
            strokeLinecap="round"
            strokeDasharray={`${fracao * circunferencia} ${circunferencia}`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">{children}</div>
    </div>
  );
}

export interface PontoLinha {
  rotulo: string;
  valor: number;
}

function caminhoSuave(pontos: { x: number; y: number }[]) {
  if (pontos.length < 2) return '';
  let d = `M ${pontos[0].x} ${pontos[0].y}`;
  for (let i = 0; i < pontos.length - 1; i += 1) {
    const anterior = pontos[i - 1] || pontos[i];
    const atual = pontos[i];
    const proximo = pontos[i + 1];
    const seguinte = pontos[i + 2] || proximo;
    const c1x = atual.x + (proximo.x - anterior.x) / 6;
    const c1y = atual.y + (proximo.y - anterior.y) / 6;
    const c2x = proximo.x - (seguinte.x - atual.x) / 6;
    const c2y = proximo.y - (seguinte.y - atual.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${proximo.x} ${proximo.y}`;
  }
  return d;
}

interface GraficoLinhaProps {
  pontos: PontoLinha[];
  formatarValor: (valor: number) => string;
}

export function GraficoLinha({ pontos, formatarValor }: GraficoLinhaProps) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const [ativo, setAtivo] = useState<number | null>(null);

  const ALTURA = 190;
  const PAD_TOPO = 18;
  const PAD_BAIXO = 28;
  const PAD_LADO = 14;

  const maximo = Math.max(...pontos.map((p) => p.valor), 1);
  const util = Math.max(largura - PAD_LADO * 2, 1);
  const passo = pontos.length > 1 ? util / (pontos.length - 1) : 0;

  const coordenadas = pontos.map((ponto, i) => ({
    x: PAD_LADO + i * passo,
    y: PAD_TOPO + (1 - ponto.valor / maximo) * (ALTURA - PAD_TOPO - PAD_BAIXO),
  }));

  const linhaBase = ALTURA - PAD_BAIXO;
  const caminho = caminhoSuave(coordenadas);
  const area = caminho ? `${caminho} L ${coordenadas[coordenadas.length - 1].x} ${linhaBase} L ${coordenadas[0].x} ${linhaBase} Z` : '';
  const destacado = ativo !== null ? coordenadas[ativo] : null;
  const indicePico = pontos.reduce((melhor, ponto, i) => (ponto.valor > pontos[melhor].valor ? i : melhor), 0);

  return (
    <div ref={ref} className="relative w-full" style={{ height: ALTURA }}>
      {largura > 0 && (
        <svg width={largura} height={ALTURA} className="overflow-visible">
          <line x1={0} y1={linhaBase} x2={largura} y2={linhaBase} stroke="#e2e8f0" strokeWidth="1" />

          {area && <path d={area} fill={COR_SERIE} fillOpacity="0.1" />}
          {caminho && <path d={caminho} fill="none" stroke={COR_SERIE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}

          {destacado && (
            <>
              <line x1={destacado.x} y1={PAD_TOPO - 8} x2={destacado.x} y2={linhaBase} stroke="#cbd5e1" strokeWidth="1" />
              <circle cx={destacado.x} cy={destacado.y} r="5" fill={COR_SERIE} stroke="#ffffff" strokeWidth="2" />
            </>
          )}

          {!destacado && coordenadas.length > 0 && (
            <>
              <circle
                cx={coordenadas[coordenadas.length - 1].x}
                cy={coordenadas[coordenadas.length - 1].y}
                r="5"
                fill={COR_SERIE}
                stroke="#ffffff"
                strokeWidth="2"
              />
              {/* Rótulo direto no pico: o valor não depende só do hover. */}
              {pontos[indicePico].valor > 0 && (
                <text
                  x={Math.max(34, Math.min(coordenadas[indicePico].x, largura - 34))}
                  y={coordenadas[indicePico].y - 12}
                  textAnchor="middle"
                  className="fill-slate-500"
                  style={{ fontSize: 11, fontWeight: 700 }}
                >
                  {formatarValor(pontos[indicePico].valor)}
                </text>
              )}
            </>
          )}

          {pontos.map((ponto, i) => (
            <text
              key={ponto.rotulo}
              x={coordenadas[i].x}
              y={ALTURA - 8}
              textAnchor="middle"
              className="fill-slate-400"
              style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}
            >
              {pontos.length > 12 && i % 2 !== 0 ? '' : ponto.rotulo}
            </text>
          ))}

          <rect
            x={0}
            y={0}
            width={largura}
            height={ALTURA}
            fill="transparent"
            onMouseLeave={() => setAtivo(null)}
            onMouseMove={(evento) => {
              const caixa = evento.currentTarget.getBoundingClientRect();
              const posicao = evento.clientX - caixa.left;
              const indice = passo > 0 ? Math.round((posicao - PAD_LADO) / passo) : 0;
              setAtivo(Math.max(0, Math.min(indice, pontos.length - 1)));
            }}
          />
        </svg>
      )}

      {destacado && ativo !== null && (
        <div
          className="absolute pointer-events-none bg-slate-900 text-white rounded-lg px-3 py-2 shadow-lg z-10"
          style={{ left: destacado.x, top: destacado.y - 14, transform: 'translate(-50%, -100%)' }}
        >
          <div className="text-[10px] tracking-wide text-slate-300">{pontos[ativo].rotulo}</div>
          <div className="text-sm font-bold tabular-nums whitespace-nowrap">{formatarValor(pontos[ativo].valor)}</div>
        </div>
      )}
    </div>
  );
}

export interface BarraDia {
  rotulo: string;
  valor: number;
  detalhe: string;
  destacado: boolean;
}

export function GraficoBarras({ barras, formatarValor }: { barras: BarraDia[]; formatarValor: (valor: number) => string }) {
  const maximo = Math.max(...barras.map((b) => b.valor), 1);

  return (
    <div className="flex items-end justify-between gap-2 h-44">
      {barras.map((barra, indice) => (
        <div key={barra.rotulo} className="group relative flex-1 flex flex-col items-center gap-3 h-full">
          <div className="flex-1 w-full flex items-end justify-center">
            <div className="relative w-5 h-full flex items-end rounded-t-[4px]" style={{ backgroundColor: COR_TRILHA }}>
              <div
                className="relative w-full rounded-t-[4px] transition-all"
                style={{
                  height: `${Math.max((barra.valor / maximo) * 100, barra.valor > 0 ? 4 : 0)}%`,
                  backgroundColor: barra.destacado ? COR_SERIE : COR_SERIE_FRACA,
                }}
              >
                {barra.destacado && barra.valor > 0 && (
                  <span
                    className={clsx(
                      'absolute bottom-full mb-1.5 text-[11px] font-bold text-slate-600 whitespace-nowrap',
                      indice === barras.length - 1
                        ? 'right-0'
                        : indice === 0
                          ? 'left-0'
                          : 'left-1/2 -translate-x-1/2'
                    )}
                  >
                    {formatarValor(barra.valor)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <span
            className={clsx(
              'text-xs w-9 text-center py-0.5 rounded-full',
              barra.destacado ? 'bg-blue-600 text-white font-bold' : 'text-slate-400'
            )}
          >
            {barra.rotulo}
          </span>

          <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-900 text-white rounded-lg px-3 py-2 shadow-lg whitespace-nowrap z-10">
            <div className="text-sm font-bold tabular-nums">{formatarValor(barra.valor)}</div>
            <div className="text-[10px] text-slate-300">{barra.detalhe}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export interface BarraHorizontal {
  rotulo: string;
  valor: number;
  formatado: string;
  percentual: number;
}

export function GraficoBarrasHorizontais({ barras }: { barras: BarraHorizontal[] }) {
  const maximo = Math.max(...barras.map((b) => b.valor), 1);

  return (
    <div className="flex flex-col gap-4">
      {barras.map((barra) => (
        <div key={barra.rotulo}>
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-sm font-medium text-slate-600">{barra.rotulo}</span>
            <span className="text-sm text-slate-800 font-bold tabular-nums">
              {barra.formatado}
              <span className="text-slate-400 font-medium ml-2">{barra.percentual.toFixed(0)}%</span>
            </span>
          </div>
          <div className="h-2 rounded-[4px] w-full" style={{ backgroundColor: COR_TRILHA }}>
            <div
              className="h-full rounded-[4px]"
              style={{ width: `${(barra.valor / maximo) * 100}%`, backgroundColor: COR_SERIE }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
