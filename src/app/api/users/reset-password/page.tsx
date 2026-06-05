import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
    try {
        const { email } = await request.json()

        if (!email) {
            return NextResponse.json(
                { message: 'E-mail inválido.' },
                { status: 400 }
            )
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        const appUrl = process.env.NEXT_PUBLIC_APP_URL

        if (!supabaseUrl || !supabaseAnonKey || !appUrl) {
            return NextResponse.json(
                { message: 'Variáveis do Supabase/App não configuradas.' },
                { status: 500 }
            )
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey)

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${appUrl}/reset-password`,
        })

        if (error) {
            return NextResponse.json(
                { message: error.message },
                { status: 400 }
            )
        }

        return NextResponse.json({
            message: 'E-mail de redefinição enviado com sucesso.',
        })
    } catch {
        return NextResponse.json(
            { message: 'Erro interno ao enviar e-mail de redefinição.' },
            { status: 500 }
        )
    }
}