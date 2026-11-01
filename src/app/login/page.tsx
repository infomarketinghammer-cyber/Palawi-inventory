import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { LanguageSwitch } from "@/components/language-switch";
import { LoginForm } from "./login-form";

export async function generateMetadata() {
  const t = await getTranslations("login");
  return { title: t("title") };
}

export default async function LoginPage() {
  const t = await getTranslations();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-4 w-full max-w-sm text-right">
        <LanguageSwitch />
      </div>
      <Card className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/palawi-logo.png" alt={`${t("app.name")} — ${t("app.tagline")}`} width={185} height={70} priority />
          <p className="mt-3 text-sm text-ink-muted">{t("app.title")}</p>
        </div>
        <h1 className="mb-4 text-xl font-semibold text-primary-800">{t("login.title")}</h1>
        <LoginForm />
      </Card>
    </main>
  );
}
