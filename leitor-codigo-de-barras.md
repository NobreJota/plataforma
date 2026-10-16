# Leitor de código de barras — especificação de compra (14/10/2026)

Uso: **venda no balcão** (bipar o produto na Nova venda) e **controle do consignado** (bipar o que sai com o técnico e o que volta, no modal da OS).
A plataforma roda no navegador (Chrome), então o leitor tem de funcionar **como teclado**: ele "digita" o número do código e dá **Enter**. Sem driver, sem programa.

## O que pedir na loja

| item | exigir | por quê |
|---|---|---|
| Tipo de leitura | **2D (imager)** | lê o código de barras comum (EAN-13) **e** QR Code; lê etiqueta amassada, brilhante ou na tela do celular. O 1D (laser/CCD) só lê barras. |
| Ligação | **USB, modo teclado (HID / "keyboard wedge")** | funciona direto no Chrome, em qualquer computador. Fugir de modelo só serial (RS-232) ou que precise de software. |
| Final da leitura | **sufixo Enter (CR)** configurável | o Enter já adiciona o produto na venda/consignado. Normalmente vem de fábrica; o manual traz o código para ligar. |
| Teclado | aceita **layout ABNT2 / Brasil** (ou "só números") | com layout errado, letras e símbolos saem trocados. Para EAN (só números) não atrapalha, mas evita problema com etiqueta própria. |
| Códigos | **EAN-13, EAN-8, Code 128, QR Code** | EAN = produto do fabricante; Code 128/QR = etiqueta própria da loja, se um dia imprimir. |
| Balcão | **com suporte/base de mesa (leitura automática)** | passa o produto na frente sem apertar gatilho. |
| Estoque / consignado | **sem fio** (base USB 2.4 GHz ou Bluetooth), **com memória** | anda até a prateleira/porta com o técnico; se sair do alcance, guarda as leituras e descarrega depois. |

### Sugestão de quantidade
- **1 leitor 2D com fio + suporte** para o balcão (venda).
- **1 leitor 2D sem fio com base e memória** para o estoque e o consignado.
- Ou um único **sem fio com base de mesa** que serve aos dois, se o balcão e o estoque forem próximos.

Marcas comuns no Brasil (exemplos, conferir preço e garantia na compra): Elgin, Tanca, Bematech, Honeywell, Zebra.

## Teste na hora da compra
1. Abrir o **Bloco de Notas** no computador da loja.
2. Bipar a caixa de um aquecedor: tem de aparecer o número do código (13 dígitos) **e pular a linha** (Enter).
3. Se aparecer letra/símbolo trocado: ajustar o layout de teclado pelo manual (código de configuração).

## O que a plataforma precisa (a fazer)
- A busca de produto da **Nova venda** e do **consignado** (modal da OS) passa a aceitar o **EAN**: bipou, achou um só produto → entra direto com quantidade 1 (bipar de novo soma).
- O EAN de cada produto precisa estar no cadastro (`arquivo_docs`). Hoje ele chega pelas notas de entrada (`_produto_origem.ean`); falta levar para o cadastro e permitir digitar/bipar no cadastro do produto.
- Produto sem EAN (peça avulsa, conexão): continua pela busca por código/descrição; mais tarde, etiqueta própria em Code 128.
