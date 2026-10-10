import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { atualizarSuspensao } from "../../../../lib/billing/assinatura";

export const maxDuration = 60;

// Chamada 1x por dia pelo Cron da Vercel (vercel.json): o bloqueio depende
// da data (fim do teste, 7 dias de atraso), então mesmo sem aviso do Asaas
// o site das lojas nessa situação sai do ar no dia certo. A Vercel envia
// "Authorization: Bearer <CRON_SECRET>".
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  const { data: empresas, error } = await supabaseAdmin
    .from("empresas")
    .select("id")
    .eq("ativo", true)
    .or("assinatura_status.neq.ativa,site_suspenso.eq.true");

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  let suspensas = 0;
  const falhas: string[] = [];

  for (const empresa of empresas || []) {
    try {
      if (await atualizarSuspensao(empresa.id)) suspensas++;
    } catch (erro) {
      console.error("Erro ao verificar assinatura", empresa.id, erro);
      falhas.push(empresa.id);
    }
  }

  return NextResponse.json({ verificadas: empresas?.length || 0, suspensas, falhas });
}
