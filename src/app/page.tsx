import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getTelegramBotUsername } from "@/lib/authLogin";
import { LandingPage } from "@/components/landing/LandingPage";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { login?: string };
}) {
  const user = await getSessionUser();
  if (user) {
    redirect("/dashboard");
  }

  const pinRequired = Boolean(
    process.env.DEV_LOGIN_PIN && process.env.DEV_LOGIN_PIN.length > 0,
  );

  return (
    <LandingPage
      botUsername={await getTelegramBotUsername()}
      pinRequired={pinRequired}
      initialLoginOpen={searchParams.login === "1"}
    />
  );
}
