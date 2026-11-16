# PetMonitor AI

> Monitoramento inteligente da Branca e da Marrie — identifica, rastreia e analisa automaticamente o comportamento de pets a partir de gravações de câmera de segurança, com visão computacional local e privacidade total.

**Stack:** Python 3.11 · OpenCV · Ultralytics YOLO · BlinkPy · SQLite · FastAPI · PWA React/TypeScript (CPU-only, Windows 11)

---

## Sumário

- [O que é](#o-que-é)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Uso rápido](#uso-rápido)
- [Verificação](#verificação)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Como trabalhamos](#como-trabalhamos)
- [Monitoramento](#monitoramento)
- [Contribuindo](#contribuindo)
- [Licença](#licença)

---

## O que é

O **PetMonitor AI** usa visão computacional para analisar gravações da câmera Blink da sala de estar, identificar as Shih Tzus **Branca** e **Marrie**, e gerar relatórios honestos e mensuráveis sobre o que cada pet fez durante o dia.

Tudo roda localmente: inferência, armazenamento e dashboard. Sem cloud obrigatório, sem dados enviados a terceiros.

**MVP atual:** MVP 0 — ambiente configurado, adapter BlinkPy funcional, importação manual de MP4 garantida.

---

## Pré-requisitos

| Requisito | Versão mínima | Observação |
|---|---|---|
| **Python** | 3.11 | Use o launcher `py -3.11` no Windows (`py -0` lista as versões instaladas) |
| **Git** | qualquer | Necessário para clonar e para o `git bash` |
| **Git Bash** | qualquer | **Obrigatório no Windows** para `scripts/*.sh` — o `bash` do PATH no PowerShell é o stub WSL e falha com `execvpe(/bin/bash) failed` |
| **Node.js** | 18+ | Apenas para ferramentas de projeto (`scripts/*.mjs`, `ai-dash`) — não é necessário para a aplicação Python |

> **Windows:** instale o Git para Windows (inclui Git Bash). Ao rodar scripts de shell, use sempre "Git Bash" ou `"C:\Program Files\Git\bin\bash.exe"`, nunca o `bash` do PowerShell.

---

## Instalação

```bash
git clone https://github.com/olavomello/petmonitor-ai.git
cd petmonitor-ai
```

### Python (backend + CLI)

```bash
# Criar venv com Python 3.11 (Windows — use o launcher py)
py -3.11 -m venv .venv

# Ativar
.venv\Scripts\activate          # PowerShell / CMD
# ou: source .venv/Scripts/activate  # Git Bash

# Instalar o pacote e dependências de desenvolvimento
pip install -e ".[dev]"
```

> Na primeira instalação, `ultralytics` baixa automaticamente os pesos do modelo YOLO (~6 MB para `yolov8n.pt`). Isso requer conexão à internet uma vez só.

### Variáveis de ambiente

```bash
cp .env.example .env
# Edite .env com suas credenciais Blink:
#   BLINK_USERNAME=seu_email@exemplo.com
#   BLINK_PASSWORD=sua_senha_blink
```

As credenciais ficam **apenas** no `.env` local — nunca são commitadas.

### Frontend (MVP 4 — ainda não implementado)

```bash
cd frontend && npm install   # aguarda implementação do MVP 4
```

---

## Uso rápido

### Importar um clipe MP4 manualmente (sem câmera)

O caminho manual é o fallback garantido e funciona sem câmera ou credenciais:

```bash
petmonitor-ingest --file caminho/para/clip.mp4
# Opcionalmente com timestamp de captura:
petmonitor-ingest --file clip.mp4 --capture-at 2026-11-16T10:00:00Z
```

### Verificar conectividade com a câmera Blink

```bash
# Requer .env preenchido com BLINK_USERNAME e BLINK_PASSWORD
petmonitor-blink
# Para uma câmera específica:
petmonitor-blink --camera "Living Room"
```

### Rodar a API local (MVP 2+)

```bash
uvicorn petmonitor.api.main:app --reload
# Acesse: http://127.0.0.1:8000/docs
# A API fica vinculada ao localhost por padrão — não é exposta publicamente.
```

---

## Verificação

`scripts/gate.sh` é o único comando de verificação: testes, cobertura e version gate em um só passo. Humanos e agentes rodam antes de todo commit.

```bash
# Windows — use sempre Git Bash, nunca o bash do PowerShell
"C:\Program Files\Git\bin\bash.exe" scripts/gate.sh

# Com checagens de release:
"C:\Program Files\Git\bin\bash.exe" scripts/gate.sh --release
```

O gate está configurado em `.agents/gate.conf` para usar o pytest do `.venv`. Se o `.venv` não existir, crie-o antes (ver [Instalação](#instalação)).

**Estado atual:** 32 testes, 96% de cobertura — ✅ gate passa.

---

## Estrutura do projeto

```
petmonitor-ai/
├── src/petmonitor/           # Pacote Python principal
│   ├── blink/                # Adapter BlinkPy (auth, discovery, download)
│   ├── ingestion/            # Intake de clipes, dedup SHA-256, proveniência
│   ├── vision/               # OpenCV + YOLO detection (MVP 1)
│   ├── tracking/             # Tracking + identidade Branca/Marrie (MVP 2)
│   ├── activities/           # Analytics, heatmaps, trajetórias (MVP 3)
│   ├── storage/              # SQLite schema e camada de dados (MVP 1+)
│   └── api/                  # FastAPI local — localhost only (MVP 2+)
│
├── frontend/                 # PWA React/TypeScript (MVP 4)
├── tests/                    # pytest — 32 testes, 96% cobertura
├── configs/
│   ├── app.yaml              # Configuração runtime (storage, detection, API, pets)
│   └── dataset.yaml          # Configuração YOLO dataset (Branca=0, Marrie=1)
│
├── scripts/                  # Ferramentas de projeto (gate, agentes, ADR, ai-dash)
├── docs/
│   ├── agents/               # Definições dos 10 agentes
│   ├── adr/                  # Architecture Decision Records
│   ├── repo-map.md           # Mapa do repositório
│   └── decisions.md          # Log de decisões arquiteturais
│
├── concept/
│   ├── concept.md            # Especificação completa do produto
│   ├── dashboard.png         # Design aprovado — desktop
│   └── app.png               # Design aprovado — mobile/PWA
│
├── assets/                   # Brand e PWA assets (logo, ícones, manifest)
├── ai-dash/                  # Dashboard estático de monitoramento de agentes
├── .env.example              # Template de variáveis de ambiente
├── pyproject.toml            # Metadados e dependências do pacote Python
├── AGENTS.md                 # Regras vinculantes para todos os agentes
├── AGENT_TEAM.md             # Política e protocolo dos 10 agentes
├── VERSION                   # Versão SemVer (fonte da verdade)
└── CHANGELOG.md              # Histórico Keep a Changelog
```

**Diretórios git-ignorados** (dados locais, nunca commitados):

| Diretório | Conteúdo |
|---|---|
| `data/` | Clipes baixados, snapshots, `petmonitor.db` |
| `datasets/` | Imagens e labels para treino do modelo |
| `models/` | Pesos treinados |
| `runs/` | Artefatos de runs de treino/avaliação |
| `.venv/` | Ambiente virtual Python |

---

## Como trabalhamos

- **Regras primeiro.** Agentes leem `AGENTS.md`; abrem `docs/agents/*` e `docs/guides/*` só quando a tarefa toca aquela área.
- **Um caminho de verificação.** Nada está "pronto" até `scripts/gate.sh` passar.
- **Decisões são registradas.** Mudanças arquiteturais geram um ADR: `node scripts/adr.mjs new "<título>"` (ver `docs/adr/`).
- **Versionamento é SemVer.** `VERSION` e entradas de release em `CHANGELOG.md` são de responsabilidade do agente principal; mudanças visíveis ao usuário vão em `[Unreleased]`.
- **Agentes trabalham em isolamento.** Agentes paralelos usam seus próprios worktrees (`bash scripts/agent-team.sh list`).
- **10 agentes especializados.** Cada módulo tem um agente dono: `@agent-dev-blink-integrator`, `@agent-dev-vision-detector`, `@agent-dev-ui-builder`, etc. Ver `AGENT_TEAM.md`.

---

## Monitoramento

Cada execução do gate é registrada localmente e agregada para o dashboard:

```bash
node scripts/ai-dash.mjs   # Serve ai-dash/ em 127.0.0.1 com área de Settings
```

`ai-dash/` é um site estático e pode ser publicado como página interna de monitoramento. Ver `ai-dash/README.md`.

---

## Contribuindo

1. Crie um branch a partir de `main` seguindo o modelo em `AGENTS.md` seção 0.
2. Faça uma mudança focada e adicione ou atualize testes.
3. Execute `"C:\Program Files\Git\bin\bash.exe" scripts/gate.sh` até passar.
4. Adicione uma linha em `[Unreleased]` no `CHANGELOG.md` para qualquer mudança visível ao usuário.
5. Abra um pull request.

---

## Licença

MIT — ver [LICENSE](LICENSE).

---

<p align="center"><sub>Powered by <a href="https://github.com/olavomello/ai-project-starter"><strong>AIS</strong></a> — AI Project Starter</sub></p>
