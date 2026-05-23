import { Disclaimer } from "@/components/Disclaimer";
import { PrivacyTools } from "./PrivacyTools";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">
          Privātums un datu īpašniecība
        </h1>
        <p className="mt-2 text-lg font-medium text-brand-800">
          Tavi dati pieder tev.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          ReceiptBox LV ir izstrādāts tā, lai <strong>oriģinālos dokumentu failus mēs apzināti
          nesaglabājam</strong>. Pēc tam, kad sistēma izvelk struktūras informāciju (summa,
          datums, piegādātājs utt.), oriģinālais fails tiek dzēsts no servera.
        </p>
      </header>

      <section className="card space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Ko mēs saglabājam</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li>
            Struktūras laukus katram izdevumam: datumus, piegādātāju, dokumenta numuru, PVN un
            kopējās summas (ieskaitot tavas labojumus un pozīcu atlasi).
          </li>
          <li>Kategorijas, apakškategorijas un profila iestatījumus, ko tu norādi.</li>
          <li>
            Īsu AI skaidrojumu un pārliecības līmeni —{' '}
            <strong>bez sensitīviem personas datiem</strong> (IBAN, personas kods, adreses utt.
            tiek izņemti pirms saglabāšanas).
          </li>
          <li>
            Telegram lietotāja ID, lai pieslēgtos vadības panelim — tas ir vienīgais &quot;accounts&quot;
            identifikators MVP versijā.
          </li>
        </ul>
      </section>

      <section className="card space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Ko mēs nesaglabājam</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li>Oriģinālo čeka/rēķina PDF vai attēlu pēc veiksmīgas apstrādes.</li>
          <li>Pilnu dokumenta teksta slāni (<code>rawExtractedText</code>) — netiek izmantots.</li>
          <li>Neapstrādātus personas datus: mēs cenšamies tos izņemt no saglabātajiem laukiem.</li>
        </ul>
        <p className="text-sm text-slate-600">
          <strong>Oriģinālais dokuments vienmēr ir pie tevis</strong> — piemēram, bankas lietotnē,
          e-pastā vai telefona galerijā. ReceiptBox satur tikai to, kas nepieciešams apkopojumiem.
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          Avota izsekošana un tavas piezīmes
        </h2>
        <p className="text-sm text-slate-700">
          Katram ierakstam ir &quot;avota tips&quot; (web vai Telegram). Lauku{' '}
          <strong>Tava piezīme</strong> vari izmantot, lai atcerētos, kur glabā oriģinālu (piem.,
          &quot;Swedbank April PDF&quot; vai &quot;mapē Downloads&quot;).
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Tavu datu eksports un dzēšana</h2>
        <PrivacyTools />
      </section>

      <Disclaimer />
    </div>
  );
}
