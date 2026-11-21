import { ArrowLeft } from 'lucide-react';
import AppIcon from '../../components/ui/AppIcon';
import { Header, IconBtn } from '../../components/ui/ui';
import { APP_NAME, APP_VERSION, AUTHOR, LEGAL_TEXT } from '../../config';

export default function AboutScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <Header
        title="Sobre"
        right={
          <IconBtn onClick={onBack} label="Voltar">
            <ArrowLeft size={20} />
          </IconBtn>
        }
      />
      <div className="scroll-y flex-1 px-5 py-6">
        <div className="flex flex-col items-center text-center">
          <div className="rounded-[28px] overflow-hidden shadow-lg shadow-black/40">
            <AppIcon size={112} />
          </div>
          <h2 className="font-sign text-3xl font-semibold mt-4">{APP_NAME}</h2>
          <div className="text-sm text-slate-400 mt-1">Versão {APP_VERSION}</div>
          <div className="text-sm text-slate-200 mt-3">
            Criado por <b>{AUTHOR}</b>
          </div>
        </div>

        <section className="mt-8 rounded-2xl bg-ink-800 border border-ink-600 p-4 space-y-3 text-sm text-slate-300 leading-relaxed">
          <h3 className="font-sign text-lg font-semibold text-slate-100">Aviso legal</h3>
          {LEGAL_TEXT.map((t, i) => (
            <p key={i}>{t}</p>
          ))}
        </section>

        <section className="mt-4 rounded-2xl bg-ink-800 border border-ink-600 p-4 text-sm text-slate-400 space-y-1">
          <h3 className="font-sign text-lg font-semibold text-slate-100">Fontes e créditos</h3>
          <p>Horários e avisos: FAOL (faol.com.br).</p>
          <p>Posição dos ônibus e previsões: Merus Tracker.</p>
          <p>Mapas: Esri e © OpenStreetMap contributors, © CARTO.</p>
        </section>
      </div>
    </div>
  );
}
