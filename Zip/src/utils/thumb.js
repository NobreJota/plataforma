import sharp from "sharp";

/**
 * Thumb padrão 300x300 com padding, SEM cortar (contain),
 * mas "mais ajustado" porque faz TRIM antes (remove sobras brancas).
 */
export async function gerarThumb300Ajustada(inputBuffer, padding = 12) {
  const size = 300;
  const inner = size - padding * 2; // ex: 300 - 24 = 276

  // 1) Normaliza (EXIF) + TRIM (remove bordas uniformes)
  //    threshold: quanto maior, mais agressivo (10~25 é comum)
  const trimmed = await sharp(inputBuffer)
    .rotate()
    .trim({ threshold: 18 })
    .toBuffer();

  // 2) Redimensiona para CABER no miolo (inner x inner) sem ampliar demais
  const resized = await sharp(trimmed)
    .resize(inner, inner, { fit: "inside", withoutEnlargement: true })
    .toBuffer();

  // 3) Cria canvas 300x300 branco e centraliza a imagem
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: "#ffffff",
    },
  })
    .composite([{ input: resized, gravity: "center" }])
    .jpeg({ quality: 88 })
    .toBuffer();
}
