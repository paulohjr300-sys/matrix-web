import { supabase } from './supabase'

let empresaIdPromise: Promise<string> | null = null

// Empresa (loja) do usuário logado. Todo arquivo enviado ao Storage fica
// numa pasta com esse id, e as policies do bucket conferem essa pasta.
export function getEmpresaId() {
    if (!empresaIdPromise) {
        empresaIdPromise = (async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser()

            if (!user) throw new Error('Não autenticado.')

            const { data, error } = await supabase
                .from('profiles')
                .select('empresa_id')
                .eq('id', user.id)
                .single()

            if (error || !data?.empresa_id) {
                throw new Error('Usuário sem empresa vinculada.')
            }

            return data.empresa_id as string
        })().catch((error) => {
            empresaIdPromise = null
            throw error
        })
    }

    return empresaIdPromise
}

// Troca de usuário na mesma aba não recarrega a página, então o cache é
// limpo a cada login/logout.
supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        empresaIdPromise = null
    }
})

export async function tenantFilePath(path: string) {
    const empresaId = await getEmpresaId()

    return `${empresaId}/${path}`
}

// Documentos ficam num bucket privado: o link é gerado na hora e expira.
export async function openVehicleDocument(filePath: string) {
    const newWindow = window.open('', '_blank')

    const { data, error } = await supabase.storage
        .from('vehicle-documents')
        .createSignedUrl(filePath, 60)

    if (error || !data?.signedUrl) {
        newWindow?.close()
        throw new Error(error?.message || 'Não foi possível abrir o documento.')
    }

    if (newWindow) {
        newWindow.location.href = data.signedUrl
    } else {
        window.location.href = data.signedUrl
    }
}
