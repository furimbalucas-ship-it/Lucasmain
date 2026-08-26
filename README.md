# Lucasmain — macOS Web

Experiência desktop macOS no navegador, pronta para deploy na [Vercel](https://vercel.com).

## Recursos

- Menu bar com relógio em tempo real
- Dock interativo com efeito de magnificação
- Janelas arrastáveis (Finder, Safari, Ajustes, Sobre)
- Botões traffic light (fechar, minimizar, maximizar)
- Spotlight Search (`Cmd/Ctrl + K`)
- Design responsivo para mobile

## Deploy na Vercel

### Opção 1 — Importar repositório

1. Acesse [vercel.com/new](https://vercel.com/new)
2. Importe este repositório GitHub
3. Clique em **Deploy** (nenhuma configuração extra necessária)

### Opção 2 — CLI

```bash
npm i -g vercel
vercel
```

## Desenvolvimento local

Abra `index.html` diretamente no navegador ou use um servidor local:

```bash
npx serve .
```

## Estrutura

```
├── index.html          # Página principal
├── css/style.css       # Estilos macOS
├── js/app.js           # Interatividade
├── assets/icons/       # Ícones SVG do Dock
└── vercel.json         # Configuração Vercel
```
