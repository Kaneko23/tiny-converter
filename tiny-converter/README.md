# Conversor Tiny — Lei Atual Jeans

Ferramenta web (React + Vite) para converter as planilhas de **Cadastro de
Produtos** e de **Pedidos** da Lei Atual para o padrão de importação do
[Tiny ERP](https://www.tiny.com.br/), sem precisar de macro no Excel.

Roda inteiramente no navegador — o upload, a conversão e a geração do
arquivo `.xlsx` final acontecem no seu computador, sem enviar a planilha
para nenhum servidor. O Supabase é opcional e serve só para "lembrar"
coisas de uma conversão para a outra (ver [Supabase](#supabase-opcional)).

## O que a ferramenta faz

### 1. Cadastro de Produtos

Você envia uma planilha no estilo do Mostruário (uma linha por referência,
com Descrição, Referência, Tecido, Cód. Molde, Cores disponíveis e Grade de
tamanhos), liga as colunas certas na tela e a ferramenta gera a planilha de
importação do Tiny já com:

- uma linha "pai" por referência e uma linha "filha" por variação de
  cor × tamanho (SKU = referência + código da cor + código do tamanho);
- a descrição de cada variação com o nome da cor quando aplicável;
- o campo `Variações` no formato que o Tiny espera (`Cores:X||Tamanho:Y||`);
- **NCM automático por tecido**: uma tabela "Tecido → NCM" (igual à de
  cores/tamanhos) preenche a Classificação Fiscal sozinha, tolerando
  maiúscula/minúscula, acento e pequenas diferenças de grafia (ex: "TRIPLO"
  casa com "TRIPLE"), mas sem arriscar trocar palavras com sentido diferente
  (ex: nunca confunde "sem elastano" com "com elastano"). Tecido não
  reconhecido cai no NCM padrão e gera aviso;
- **Origem, CEST e acréscimo de preço por tamanho** configuráveis nos
  valores padrão — dá pra, por exemplo, somar automaticamente um valor fixo
  ao preço dos tamanhos G1/G2.

### 2. Pedidos

Você envia o histórico de pedidos (uma linha por item: nº do pedido,
cliente, referência, cor, tamanho, quantidade, valor), liga as colunas, e a
ferramenta gera a planilha de pedido de venda do Tiny, repetindo os dados
do cabeçalho do pedido em cada linha de item, calculando o SKU e montando
a descrição final (`Descrição - Cor - Tamanho`), e preenchendo CNPJ/CPF e
Inscrição Estadual a partir de uma tabela de clientes.

**Regra importante sobre cor no SKU dos pedidos**, descoberta ao comparar o
histórico real de pedidos com o resultado esperado no Tiny: a coluna
"Cor" do pedido é só decorativa (vira texto na descrição, mas não entra no
SKU). Quando a cor É parte do SKU, ela vem embutida na própria referência,
como `2830/3` (referência `2830`, variante de cor `3`) — nesse caso o "/3"
é usado para montar o código do SKU, e o número da variante aponta para a
mesma tabela de cores. A ferramenta já trata os dois casos.

**Cadastro de clientes**: além de enviar uma planilha de clientes, dá pra
cadastrar um cliente na mão (botão "+ Cadastrar cliente manualmente"), com
endereço, CEP, telefone, e-mail etc. Com o Supabase configurado, isso já
salva na hora e a tela carrega os clientes salvos sozinha da próxima vez —
sem precisar reenviar planilha nenhuma.

### Limite de 2 MB do Tiny

O Tiny só aceita arquivos de até ~2 MB por importação. Quando o resultado
(produtos ou pedidos) passa desse tamanho, a ferramenta divide sozinha em
duas ou mais partes — sempre mantendo um produto (pai + variações) ou um
pedido (todos os itens) inteiro dentro do mesmo arquivo, nunca partido ao
meio. Quando isso acontece, aparecem botões "Baixar parte 1 de N", "parte 2
de N" etc. em vez de um único botão de download.

## Rodando localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`. Sem nenhuma configuração de Supabase, a
ferramenta já funciona 100% (upload → mapear colunas → converter → baixar).

## Publicando (GitHub + Vercel)

1. Suba esta pasta para um repositório seu no GitHub.
2. Na [Vercel](https://vercel.com), "Add New Project" → importe o
   repositório. O framework (Vite) é detectado automaticamente —
   build command `npm run build`, output `dist`.
3. Se for usar Supabase (recomendado), configure as variáveis de ambiente
   do projeto na Vercel (Project Settings → Environment Variables):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   (veja de onde tirar esses valores na seção [Supabase](#supabase-opcional)).
4. Deploy. Pronto — cada push na branch principal atualiza o site.

## Supabase (opcional)

Sem o Supabase configurado, a ferramenta funciona normalmente, só que cada
pessoa precisa reenviar/remapear as planilhas de apoio (clientes, tabela de
cores) toda vez. Configurando o Supabase, a ferramenta ganha:

- **login da equipe** (e-mail/senha) — sem isso, qualquer pessoa com o link
  do site poderia usar a ferramenta;
- **clientes salvos**, reaproveitados nos próximos pedidos;
- **catálogo de produtos salvo**, gerado a partir da conversão de produtos;
- **histórico simples** de quantas linhas cada conversão gerou.

### Passo a passo

1. Crie um projeto em [supabase.com](https://supabase.com) (ou use um que
   você já tenha — ele fica isolado por schema/tabelas, não interfere em
   outros projetos seus).
2. No painel do projeto, abra **SQL Editor** → **New query**, cole o
   conteúdo do arquivo [`supabase/schema.sql`](./supabase/schema.sql) deste
   repositório e rode. Isso cria as tabelas (`clients`, `products`,
   `color_palettes`, `size_palettes`, `mapping_presets`,
   `conversion_logs`) e as políticas de segurança (só usuário logado lê/
   escreve).
3. Em **Authentication → Users**, crie um usuário para cada pessoa da
   equipe que vai usar a ferramenta (e-mail + senha).
4. Em **Project Settings → API**, copie a **Project URL** e a chave
   **anon public** — são os valores de `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY`.
5. Configure essas duas variáveis localmente (arquivo `.env.local`, copiando
   de `.env.example`) e/ou na Vercel, e reinicie.

A chave `anon` fica visível no código do site — isso é normal e esperado no
Supabase, a segurança de verdade vem das políticas de RLS criadas pelo
`schema.sql` (só usuário autenticado lê/escreve). Não use a chave
`service_role` no front-end.

## Estrutura do projeto

```
src/
  lib/                  lógica pura de conversão (sem depender do navegador)
    types.ts            tipos compartilhados
    xlsxIO.ts            ler/escrever arquivos .xlsx (SheetJS)
    sizeRules.ts         grade de tamanhos (faixas numéricas e em letra)
    colorRules.ts        tabela de cores / leitura de texto tipo "COR 1,2,3"
    tinyFormats.ts       cabeçalhos EXATOS esperados pelo Tiny
    productConverter.ts  planilha de produtos -> padrão Tiny
    orderConverter.ts    planilha de pedidos -> padrão Tiny
  components/            peças de UI reutilizáveis (upload, mapeamento de
                          colunas, tabelas editáveis de cores/tamanhos, ...)
  pages/                 as duas telas (Produtos, Pedidos)
  supabase/               cliente Supabase, login, acesso a dados
scripts/                  scripts de validação (rodados com `npx tsx`,
                          não fazem parte do site publicado)
supabase/schema.sql        schema do banco
```

## Validando a lógica de conversão

Os scripts em `scripts/` comparam a conversão com pares reais de entrada→
saída (uma planilha de pedidos de exemplo e o resultado esperado no Tiny)
para garantir que a lógica de SKU/descrição/cliente está correta. Para
rodar (precisa apontar para as planilhas reais, que não ficam neste
repositório por conterem dados de clientes):

```bash
CONVERSOR_PATH=/caminho/para/Conversor_Tiny_Lei_Atual.xlsm npx tsx scripts/validate-orders.ts
MOSTRUARIO_PATH=/caminho/para/MOSTRUARIO_VERAO_27.xlsx npx tsx scripts/validate-products.ts
```

## Coisas para revisar / próximos passos

- **NCM**: a tabela "Tecido → NCM" já vem com os dados fornecidos, mas
  tecidos novos ou com nome muito diferente do cadastrado (ex: "OASIS",
  "RAZZIS", "FILIPE") não são reconhecidos e caem no NCM padrão com aviso —
  vale ir completando a tabela conforme aparecerem.
- **CSOSN** não é preenchido pela ferramenta: a planilha de importação de
  produtos do Tiny não tem essa coluna — o CSOSN é configurado dentro do
  próprio Tiny (na regra fiscal), não no arquivo de importação.
- **Preço nos pedidos**: hoje o preço vem direto da coluna "Valor Unit." da
  planilha de pedidos. Se quiser, dá para ligar a conferência automática
  contra o catálogo salvo no Supabase (a função `findProductPriceBySku` já
  existe em `src/supabase/repositories.ts`, só falta wire-up na tela de
  Pedidos) para avisar quando o valor digitado pelo representante for
  diferente do praticado.
- **Data de entrega sem ano** (planilhas antigas às vezes só têm "15/04"):
  a ferramenta pede um "ano padrão" na tela quando isso acontece — confira
  se o ano está certo antes de importar.
