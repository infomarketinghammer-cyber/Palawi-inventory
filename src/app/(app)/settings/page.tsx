import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { getFormatPrefs } from "@/lib/i18n-helpers";
import { Card, CardTitle, PageHeader } from "@/components/ui/card";
import { LanguageSwitch } from "@/components/language-switch";
import { NumeralSwitch } from "./numeral-switch";
import { PasswordForm } from "./password-form";

export async function generateMetadata() {
  return { title: (await getTranslations("settings"))("title") };
}

export default async function SettingsPage() {
  await requireUser();
  const t = await getTranslations("settings");
  const { numerals } = await getFormatPrefs();

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />
      <Card className="space-y-5">
        <div className="space-y-2">
          <CardTitle>{t("language")}</CardTitle>
          <LanguageSwitch />
        </div>
        <div className="space-y-2">
          <CardTitle>{t("numerals")}</CardTitle>
          <NumeralSwitch current={numerals} latinLabel={t("numeralsLatin")} devaLabel={t("numeralsDeva")} groupLabel={t("numerals")} />
        </div>
      </Card>
      <PasswordForm />
    </div>
  );
}
