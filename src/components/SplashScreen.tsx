import AppIcon from './ui/AppIcon';
import { APP_NAME } from '../config';

export default function SplashScreen() {
  return (
    <div
      className="fixed inset-0 z-[5000] bg-[#1F6FEB] grid place-items-center animate-[fadeout_.4s_ease_.8s_forwards]"
      aria-hidden
    >
      <div className="flex flex-col items-center gap-4 text-white">
        <div className="rounded-[28px] overflow-hidden shadow-2xl">
          <AppIcon size={120} />
        </div>
        <div className="font-sign text-3xl font-semibold">{APP_NAME}</div>
      </div>
    </div>
  );
}
