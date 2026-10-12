// Número brasileiro só com dígitos e com o código do país (55): o que o
// WhatsApp (wa.me) e os portais esperam. Com DDD e sem o 55 (10 ou 11
// dígitos), completa; outros formatos ficam só com os dígitos.
export function comCodigoDoPais(valor: string | null | undefined) {
  const digitos = (valor || '').replace(/\D/g, '')
  return digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos
}
