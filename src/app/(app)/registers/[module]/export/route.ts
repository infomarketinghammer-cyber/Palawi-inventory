import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isModuleKey } from "@/lib/modules";
import { getFormatPrefs } from "@/lib/i18n-helpers";
import { localName } from "@/lib/format";
import { validMonth } from "@/lib/ui-data";
import { registerReport } from "@/lib/register-report";
import { xlsxResponse } from "@/lib/xlsx";

export async function GET(req: Request, { params }: { params: Promise<{ module: string }> }) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { module } = await params;
  if (!isModuleKey(module)) return new Response("Not found", { status: 404 });
  const month = validMonth(new URL(req.url).searchParams.get("month") ?? undefined);
  const { locale, numerals } = await getFormatPrefs();
  const report = await registerReport(session, module, month, locale, numerals);
  const inst = session.institutionId ? await prisma.institution.findFirst({ where: { id: session.institutionId, clientId: session.clientId } }) : null;
  return xlsxResponse(`${module}-${month}.xlsx`, [inst ? localName(inst, locale) : "", `${report.title} — ${month}`], report.columns, report.rows);
}
