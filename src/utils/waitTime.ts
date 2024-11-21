import { BotContext } from "@builderbot/bot/dist/types";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";

export function getRandomTimeWaiting(
  min: number = 3000,
  max: number = 10000
): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const waitT = (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(ms);
    }, ms);
  });
};

export const composingRandomTime = async (
  ctx: BotContext,
  provider: Provider
) => {
  const randomTime = getRandomTimeWaiting();
  await provider.vendor.sendPresenceUpdate("composing", ctx.key.remoteJid);
  await waitT(randomTime);
  await provider.vendor.sendPresenceUpdate("available", ctx.key.remoteJid);
};
