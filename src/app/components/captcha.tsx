'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

// Captcha Cloudflare Turnstile (normalmente invisível ou um clique). Sem
// NEXT_PUBLIC_TURNSTILE_SITE_KEY não aparece nada e o token fica vazio:
// as telas funcionam sem captcha.

export const CAPTCHA_ATIVO = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)

type Turnstile = {
    render: (elemento: HTMLElement, opcoes: Record<string, unknown>) => string
    reset: (id: string) => void
    remove: (id: string) => void
}

declare global {
    interface Window {
        turnstile?: Turnstile
    }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let carregando: Promise<void> | null = null

function carregarScript() {
    if (window.turnstile) return Promise.resolve()

    if (!carregando) {
        carregando = new Promise((resolve, reject) => {
            const script = document.createElement('script')
            script.src = SCRIPT
            script.async = true
            script.onload = () => resolve()
            script.onerror = () => {
                carregando = null
                reject(new Error('Falha ao carregar o captcha.'))
            }
            document.head.appendChild(script)
        })
    }

    return carregando
}

export type CaptchaHandle = {
    // Token atual (vazio sem captcha). Cada token vale para uma tentativa.
    token: () => string
    // Gera um token novo (depois de usar o anterior) e espera ficar pronto.
    novoToken: () => Promise<string>
}

export const Captcha = forwardRef<CaptchaHandle, { onChange?: (token: string) => void }>(function Captcha(
    { onChange },
    ref
) {
    const container = useRef<HTMLDivElement>(null)
    const widgetId = useRef<string | null>(null)
    const tokenAtual = useRef('')
    const esperando = useRef<((token: string) => void)[]>([])
    const onChangeRef = useRef(onChange)

    useEffect(() => {
        onChangeRef.current = onChange
    }, [onChange])

    useEffect(() => {
        const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
        if (!siteKey) return

        let ativo = true

        const definir = (token: string) => {
            tokenAtual.current = token
            onChangeRef.current?.(token)

            if (token) {
                for (const resolver of esperando.current.splice(0)) resolver(token)
            }
        }

        carregarScript()
            .then(() => {
                if (!ativo || !container.current || !window.turnstile) return

                widgetId.current = window.turnstile.render(container.current, {
                    sitekey: siteKey,
                    language: 'pt-br',
                    theme: 'light',
                    callback: (token: string) => definir(token),
                    'expired-callback': () => definir(''),
                    'error-callback': () => definir(''),
                })
            })
            .catch((error) => console.error(error))

        return () => {
            ativo = false
            if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current)
            widgetId.current = null
        }
    }, [])

    useImperativeHandle(ref, () => ({
        token: () => tokenAtual.current,
        novoToken: () => {
            if (!CAPTCHA_ATIVO) return Promise.resolve('')

            tokenAtual.current = ''
            onChangeRef.current?.('')
            if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current)

            return new Promise<string>((resolve, reject) => {
                const limite = setTimeout(() => reject(new Error('Captcha não respondeu.')), 20000)
                esperando.current.push((token) => {
                    clearTimeout(limite)
                    resolve(token)
                })
            })
        },
    }))

    if (!CAPTCHA_ATIVO) return null

    return <div ref={container} className="flex min-h-[65px] justify-center" />
})
