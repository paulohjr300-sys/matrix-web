// Campo obrigatório esquecido: deixa o campo vermelho, rola a tela até ele
// e põe o cursor nele. O vermelho some quando a pessoa mexe no campo.
// O campo é achado pelo atributo data-campo="<nome>".
export function destacarCampo(campo: string) {
    const elemento = document.querySelector<HTMLElement>(`[data-campo="${campo}"]`)
    if (!elemento) return

    elemento.classList.add('campo-erro')
    elemento.scrollIntoView({ behavior: 'smooth', block: 'center' })
    elemento.focus({ preventScroll: true })

    const limpar = () => {
        elemento.classList.remove('campo-erro')
        elemento.removeEventListener('input', limpar)
        elemento.removeEventListener('change', limpar)
    }

    elemento.addEventListener('input', limpar)
    elemento.addEventListener('change', limpar)
}
