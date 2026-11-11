import type { TriviaCard } from './types'

export const FALLBACK_CARDS: TriviaCard[] = [
  { id: 1, category: "Ciência & Natureza", question: "Quantos ossos tem o corpo humano adulto?", answer: 206, unit: "ossos", ducks: 2, fact: "Ao nascer temos cerca de 270 ossos, mas muitos se fundem durante o crescimento!" },
  { id: 2, category: "Curiosidades & Cotidiano", question: "Quantos dentes tem um ser humano adulto completo (com os 4 sisos)?", answer: 32, unit: "dentes", ducks: 1, fact: "São 8 incisivos, 4 caninos, 8 pré-molares e 12 molares (incluindo os 4 do siso)." },
  { id: 3, category: "Mundo & Geografia", question: "Quantos andares tem o famoso edifício Empire State Building em Nova York?", answer: 102, unit: "andares", ducks: 3, fact: "Ele tem 102 andares e foi o primeiro do mundo a passar dos 100!" },
  { id: 4, category: "Cultura Pop & Música", question: "Quantas teclas tem um piano acústico de concerto padrão?", answer: 88, unit: "teclas", ducks: 2, fact: "São 52 teclas brancas e 36 pretas." },
  { id: 5, category: "Ciência & Natureza", question: "Qual a velocidade máxima oficial registrada de um guepardo (em km/h)?", answer: 120, unit: "km/h", ducks: 2, fact: "Ele acelera de 0 a 100 km/h em impressionantes 3 segundos!" },
  { id: 6, category: "Mundo & Geografia", question: "Quantos países membros independentes compõem a ONU atualmente?", answer: 193, unit: "países", ducks: 3, fact: "Além de 2 Estados observadores oficiais: o Vaticano e a Palestina." },
  { id: 7, category: "Jogos & Tabuleiro", question: "Quantas casas tem um tabuleiro de xadrez tradicional?", answer: 64, unit: "casas", ducks: 1, fact: "Uma matriz 8x8 de 32 casas claras e 32 escuras." },
  { id: 8, category: "Brasil & Geografia", question: "Quantas estrelas estão estampadas na bandeira do Brasil?", answer: 27, unit: "estrelas", ducks: 2, fact: "Representam os 26 estados brasileiros mais o Distrito Federal." },
  { id: 9, category: "Esportes", question: "Quantos minutos dura o tempo regulamentar de uma partida de futebol oficial?", answer: 90, unit: "minutos", ducks: 1, fact: "Dois tempos de 45 minutos mais acréscimos do árbitro." },
  { id: 10, category: "Ciência & Natureza", question: "Quantos corações tem um polvo?", answer: 3, unit: "corações", ducks: 1, fact: "Dois bombeiam sangue para as brânquias e um para o resto do corpo!" },
  { id: 11, category: "História", question: "Em que ano o homem pisou na Lua pela primeira vez?", answer: 1969, unit: "ano", ducks: 3, fact: "Neil Armstrong e Buzz Aldrin pousaram com o módulo Lunar Eagle em 20 de julho de 1969." },
  { id: 12, category: "Cultura & Cinema", question: "Quantas estatuetas do Oscar o filme Titanic (1997) ganhou?", answer: 11, unit: "Oscars", ducks: 2, fact: "Empatado com Ben-Hur (1959) e O Senhor dos Anéis: O Retorno do Rei (2003)." },
  { id: 13, category: "Ciência & Espaço", question: "Quantos planetas existem no nosso Sistema Solar oficial?", answer: 8, unit: "planetas", ducks: 1, fact: "Mercúrio, Vênus, Terra, Marte, Júpiter, Saturno, Urano e Netuno (Plutão foi reclassificado em 2006)." },
  { id: 14, category: "Cotidiano", question: "Quantos segundos tem 1 hora inteira?", answer: 3600, unit: "segundos", ducks: 2, fact: "60 minutos vezes 60 segundos por minuto!" },
  { id: 15, category: "Natureza & Animais", question: "Quantas patas tem uma aranha tradicional?", answer: 8, unit: "patas", ducks: 1, fact: "Aracnídeos têm 8 patas, enquanto insetos têm 6." }
]

export async function fetchCardsDatabase(): Promise<TriviaCard[]> {
  try {
    const res = await fetch('/games/nem-a-pato/cards.json')
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        return data as TriviaCard[]
      }
    }
  } catch {
    // Fallback on network or static failure
  }
  return FALLBACK_CARDS
}
