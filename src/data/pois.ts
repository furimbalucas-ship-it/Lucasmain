export interface Poi {
  id: string;
  name: string;
  description: string;
  longitude: number;
  latitude: number;
  height: number;
  emoji: string;
}

/** Pontos reais de Itamaracá com coordenadas de referência (WGS84). */
export const ITAMARACA_POIS: Poi[] = [
  {
    id: "forte-orange",
    name: "Forte Orange",
    description:
      "Forte holandês do século XVII, patrimônio histórico na ponta norte da ilha.",
    longitude: -34.8772,
    latitude: -7.6883,
    height: 80,
    emoji: "🏰",
  },
  {
    id: "vila-itamaraca",
    name: "Vila de Itamaracá",
    description: "Centro histórico e comercial da ilha, às margens do Canal de Santa Cruz.",
    longitude: -34.8275,
    latitude: -7.7521,
    height: 60,
    emoji: "🏘️",
  },
  {
    id: "praia-forte-orange",
    name: "Praia de Forte Orange",
    description: "Praia de águas calmas próxima ao forte, popular entre moradores e visitantes.",
    longitude: -34.8720,
    latitude: -7.6910,
    height: 40,
    emoji: "🏖️",
  },
  {
    id: "ponte-caieiras",
    name: "Ponte Caieiras Ayrton Senna",
    description: "Viaduto que liga a ilha ao continente, sobre o Canal de Santa Cruz.",
    longitude: -34.8480,
    latitude: -7.7350,
    height: 70,
    emoji: "🌉",
  },
  {
    id: "reserva-saltinho",
    name: "Reserva Biológica de Saltinho",
    description: "Área de preservação de manguezais e fauna na porção continental próxima.",
    longitude: -34.8650,
    latitude: -7.7100,
    height: 50,
    emoji: "🌿",
  },
  {
    id: "coroa-do-aviao",
    name: "Coroa do Avião",
    description: "Banco de areia famoso no Canal de Santa Cruz, visível na maré baixa.",
    longitude: -34.8350,
    latitude: -7.7580,
    height: 30,
    emoji: "✈️",
  },
];

/** Centro geográfico da ilha para posição inicial da câmera. */
export const ITAMARACA_CENTER = {
  longitude: -34.835,
  latitude: -7.735,
  height: 350,
};

export const ITAMARACA_BOUNDS = {
  west: -34.92,
  south: -7.82,
  east: -34.78,
  north: -7.66,
};
